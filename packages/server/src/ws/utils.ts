import type { WebSocket } from 'ws'
import type { Session } from '@chat-deck/shared'
import type { SessionService } from '../services/session.js'

/** Send JSON to a WebSocket client if the connection is still open. */
export function sendJSON(ws: WebSocket, data: unknown): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data))
}

/**
 * Auto-title a session from the first user message if the title is still the default.
 * Accepts an optional pre-fetched session to avoid a redundant read from disk.
 */
export async function autoTitleSession(
  sessions: SessionService,
  sessionId: string,
  existingSession?: Session | null,
): Promise<void> {
  const session = existingSession ?? await sessions.getById(sessionId)
  if (session && session.title === 'New Chat') {
    const firstUserMsg = session.messages.find(m => m.role === 'user')
    if (firstUserMsg) {
      const text = firstUserMsg.content.replace(/\n/g, ' ').trim()
      // Use Array.from to handle multi-byte/emoji characters safely
      const chars = Array.from(text)
      const autoTitle = chars.length > 50
        ? chars.slice(0, 50).join('') + '...'
        : text
      await sessions.update(sessionId, { title: autoTitle })
    }
  }
}
