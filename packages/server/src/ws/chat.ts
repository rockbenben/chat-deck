import type { WebSocket } from 'ws'
import type { SessionService } from '../services/session.js'
import type { ProfileService } from '../services/profile.js'
import type { AdapterRegistry } from '../adapters/registry.js'
import { CompareHandler } from './compare.js'
import { sendJSON, autoTitleSession } from './utils.js'

interface SendMessage { type: 'send'; sessionId: string; content: string; regenerate?: boolean; provider?: string; model?: string }
interface AbortMessage { type: 'abort'; sessionId: string }
interface CompareMessage { type: 'compare'; sessionId: string; content: string; providers: string[] }
interface SaveWinnerMessage { type: 'save-winner'; sessionId: string; content: string; comparison?: Record<string, unknown> }
type ClientMessage = SendMessage | AbortMessage | CompareMessage | SaveWinnerMessage

export class ChatHandler {
  private activeProcesses = new Map<string, { abort: () => void; ws: WebSocket }>()
  private compareHandler: CompareHandler

  constructor(
    private sessions: SessionService,
    private profiles: ProfileService,
    private registry: AdapterRegistry,
  ) {
    this.compareHandler = new CompareHandler(sessions, profiles, registry)
  }

  private static readonly MAX_CONTENT_LENGTH = 500_000

  async handleMessage(ws: WebSocket, msg: ClientMessage): Promise<void> {
    // Validate sessionId presence and type
    if (!msg.sessionId || typeof msg.sessionId !== 'string') {
      sendJSON(ws, { type: 'error', error: 'Missing or invalid sessionId' })
      return
    }
    // Validate content length on messages that carry user text
    if ('content' in msg && typeof msg.content === 'string' && msg.content.length > ChatHandler.MAX_CONTENT_LENGTH) {
      sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: 'Message content too large' })
      return
    }
    if (msg.type === 'abort') {
      const proc = this.activeProcesses.get(msg.sessionId)
      if (proc) { proc.abort(); this.activeProcesses.delete(msg.sessionId) }
      this.compareHandler.abortCompare(msg.sessionId)
      return
    }
    if (msg.type === 'compare') { await this.compareHandler.handleCompare(ws, msg); return }
    if (msg.type === 'save-winner') { await this.compareHandler.saveWinner(ws, msg.sessionId, msg.content, msg.comparison); return }
    if (msg.type === 'send') { await this.handleSend(ws, msg); return }
    sendJSON(ws, { type: 'error', error: 'Unknown message type' })
  }

  /** Abort all active processes owned by a disconnecting WebSocket. */
  cleanupConnection(ws: WebSocket): void {
    for (const [sessionId, entry] of this.activeProcesses) {
      if (entry.ws === ws) {
        entry.abort()
        this.activeProcesses.delete(sessionId)
      }
    }
    this.compareHandler.cleanupConnection(ws)
  }

  private async handleSend(ws: WebSocket, msg: SendMessage): Promise<void> {
    if (this.activeProcesses.has(msg.sessionId)) {
      sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: 'A response is already in progress for this session' })
      return
    }
    const session = await this.sessions.getById(msg.sessionId)
    if (!session) { sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: 'Session not found' }); return }
    const profile = await this.profiles.getById(session.profileId)
    if (!profile) { sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: 'Profile not found' }); return }

    // Resolve provider: per-message override takes precedence over profile default
    const providerName = msg.provider || profile.cliProvider
    const model = msg.model
    const adapter = this.registry.get(providerName)
    if (!adapter) { sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: `Provider "${providerName}" not available` }); return }

    let updatedSession
    if (msg.regenerate) {
      // Regenerate mode: user message already exists as the last message, skip adding
      updatedSession = await this.sessions.getById(msg.sessionId)
    } else {
      try {
        updatedSession = await this.sessions.addMessage(msg.sessionId, { role: 'user', content: msg.content })
      } catch (err) {
        sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: err instanceof Error ? err.message : 'Failed to save message' })
        return
      }
    }
    if (!updatedSession) return

    let assistantContent = ''
    let completed = false
    const startTime = Date.now()
    const handle = adapter.sendMessage({
      systemPrompt: profile.systemPrompt,
      messages: updatedSession.messages,
      model,
      sessionMeta: updatedSession.adapterMeta,
      onChunk: (text: string) => {
        if (completed) return
        assistantContent += text
        sendJSON(ws, { type: 'chunk', sessionId: msg.sessionId, content: text })
      },
      onDone: async (meta?: Record<string, unknown>) => {
        if (completed) return
        completed = true
        this.activeProcesses.delete(msg.sessionId)
        try {
          const durationMs = Date.now() - startTime
          const mode = (meta?.mode as string) || 'cli'
          const { mode: _m, ...rest } = meta || {}
          const saved = await this.sessions.addMessage(
            msg.sessionId,
            {
              role: 'assistant',
              content: assistantContent,
              provider: providerName,
              model: (meta?.model as string) || model || adapter.defaultModel,
              durationMs,
            },
            Object.keys(rest).length > 0 ? rest : undefined,
          )
          await autoTitleSession(this.sessions, msg.sessionId, saved)
          sendJSON(ws, { type: 'done', sessionId: msg.sessionId, mode })
        } catch {
          sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: 'Failed to save response' })
        }
      },
      onError: (error: Error) => {
        if (completed) return
        completed = true
        this.activeProcesses.delete(msg.sessionId)
        sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: error.message })
      },
    })
    this.activeProcesses.set(msg.sessionId, { ...handle, ws })
  }
}
