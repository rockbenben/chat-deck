import type { WebSocket } from 'ws'
import type { SessionService } from '../services/session.js'
import type { ProfileService } from '../services/profile.js'
import type { AdapterRegistry } from '../adapters/registry.js'
import { sendJSON, autoTitleSession } from './utils.js'

interface CompareMessage { type: 'compare'; sessionId: string; content: string; providers: string[] }

export class CompareHandler {
  private activeCompares = new Map<string, { handles: Array<{ abort: () => void }>; remaining: number; ws: WebSocket }>()

  constructor(
    private sessions: SessionService,
    private profiles: ProfileService,
    private registry: AdapterRegistry,
  ) {}

  private static readonly MAX_PROVIDERS = 10

  async handleCompare(ws: WebSocket, msg: CompareMessage): Promise<void> {
    if (msg.providers && msg.providers.length > CompareHandler.MAX_PROVIDERS) {
      sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: `Too many providers (max ${CompareHandler.MAX_PROVIDERS})` })
      return
    }
    if (this.activeCompares.has(msg.sessionId)) {
      sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: 'A compare is already in progress for this session' })
      return
    }
    const session = await this.sessions.getById(msg.sessionId)
    if (!session) { sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: 'Session not found' }); return }
    const profile = await this.profiles.getById(session.profileId)
    if (!profile) { sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: 'Profile not found' }); return }

    // Validate providers BEFORE saving the user message
    const providers = msg.providers.length > 0
      ? msg.providers.filter(p => this.registry.get(p))
      : this.registry.getAll().map(a => a.name)

    if (providers.length === 0) {
      sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: 'No providers available' })
      return
    }

    let updatedSession
    try {
      updatedSession = await this.sessions.addMessage(msg.sessionId, { role: 'user', content: msg.content })
    } catch (err) {
      sendJSON(ws, { type: 'error', sessionId: msg.sessionId, error: err instanceof Error ? err.message : 'Failed to save message' })
      return
    }
    if (!updatedSession) return

    const handles: Array<{ abort: () => void }> = []
    const entry = { handles, remaining: providers.length, ws }
    this.activeCompares.set(msg.sessionId, entry)
    const completedProviders = new Set<string>()

    for (const providerName of providers) {
      const adapter = this.registry.get(providerName)!

      const markDone = () => {
        if (completedProviders.has(providerName)) return false
        completedProviders.add(providerName)
        entry.remaining--
        if (entry.remaining <= 0) this.activeCompares.delete(msg.sessionId)
        return true
      }

      const handle = adapter.sendMessage({
        systemPrompt: profile.systemPrompt,
        messages: updatedSession.messages,
        sessionMeta: session.adapterMeta,
        onChunk: (text: string) => {
          if (completedProviders.has(providerName)) return
          sendJSON(ws, {
            type: 'compare-chunk',
            sessionId: msg.sessionId,
            provider: providerName,
            content: text,
          })
        },
        onDone: (meta?: Record<string, unknown>) => {
          if (!markDone()) return
          const mode = (meta?.mode as string) || 'cli'
          sendJSON(ws, {
            type: 'compare-done',
            sessionId: msg.sessionId,
            provider: providerName,
            mode,
          })
        },
        onError: (error: Error) => {
          if (!markDone()) return
          sendJSON(ws, {
            type: 'compare-error',
            sessionId: msg.sessionId,
            provider: providerName,
            error: error.message,
          })
        },
      })

      handles.push(handle)
    }
  }

  abortCompare(sessionId: string): void {
    const entry = this.activeCompares.get(sessionId)
    if (entry) {
      entry.handles.forEach(h => h.abort())
      this.activeCompares.delete(sessionId)
    }
  }

  /** Abort all active compares owned by a disconnecting WebSocket. */
  cleanupConnection(ws: WebSocket): void {
    for (const [sessionId, entry] of this.activeCompares) {
      if (entry.ws === ws) {
        entry.handles.forEach(h => h.abort())
        this.activeCompares.delete(sessionId)
      }
    }
  }

  async saveWinner(ws: WebSocket, sessionId: string, content: string, comparison?: Record<string, unknown>): Promise<void> {
    try {
      const saved = await this.sessions.addMessage(sessionId, { role: 'assistant', content })
      if (!saved) {
        sendJSON(ws, { type: 'error', sessionId, error: 'Session not found' })
        return
      }
      // Persist the comparison record to session metadata if provided
      if (comparison) {
        const session = await this.sessions.getById(sessionId)
        if (session) {
          const comparisons = (session.adapterMeta?.comparisons as unknown[]) ?? []
          comparisons.push(comparison)
          await this.sessions.updateMeta(sessionId, { comparisons })
        }
      }
      await autoTitleSession(this.sessions, sessionId, saved)
      sendJSON(ws, { type: 'done', sessionId, mode: 'compare' })
    } catch (err) {
      sendJSON(ws, { type: 'error', sessionId, error: err instanceof Error ? err.message : 'Failed to save winner' })
    }
  }
}
