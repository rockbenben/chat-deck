import type { StorageService } from './storage.js'
import type { Session } from '@chat-deck/shared'
import fs from 'fs/promises'
import path from 'path'

export async function migrateSessionsIfNeeded(storage: StorageService): Promise<number> {
  const dir = path.join(storage.basePath, 'sessions')
  let entries: string[]
  try { entries = await fs.readdir(dir) } catch { return 0 }

  const oldFiles = entries.filter(f => f.endsWith('.json') && !f.endsWith('.meta.json') && !f.startsWith('.'))
  let migrated = 0

  for (const file of oldFiles) {
    const id = file.replace('.json', '')
    const metaPath = path.join(dir, `${id}.meta.json`)
    try { await fs.access(metaPath); continue } catch { /* not yet migrated */ }

    try {
      const raw = await fs.readFile(path.join(dir, file), 'utf-8')
      const session = JSON.parse(raw) as Session
      const messages = session.messages || []

      const meta = {
        id: session.id,
        profileId: session.profileId,
        title: session.title,
        messageCount: messages.length,
        adapterMeta: session.adapterMeta,
        parentId: session.parentId,
        forkPoint: session.forkPoint,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        archived: session.archived || false,
      }
      await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), 'utf-8')

      const jsonlPath = path.join(dir, `${id}.messages.jsonl`)
      const lines = messages.map(m => JSON.stringify(m)).join('\n') + (messages.length ? '\n' : '')
      await fs.writeFile(jsonlPath, lines, 'utf-8')

      await fs.unlink(path.join(dir, file))
      migrated++
    } catch (err) {
      console.error(`[migration] Failed to migrate session ${id}:`, err)
    }
  }
  if (migrated > 0) console.log(`[migration] Migrated ${migrated} sessions to split format`)
  return migrated
}
