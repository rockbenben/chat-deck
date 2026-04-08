import { v4 as uuid } from 'uuid'
import fs from 'fs/promises'
import path from 'path'
import type { Session, SessionMeta, Message, CreateSessionInput } from '@chat-deck/shared'
import type { StorageService } from './storage.js'

const MAX_PARALLEL_READS = 50
const META_EXT = '.meta'
const MESSAGES_EXT = '.messages.jsonl'

/** Run promises with concurrency limit */
async function parallelLimit<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  if (tasks.length === 0) return []
  const results: T[] = []
  let i = 0
  const run = async () => {
    while (i < tasks.length) {
      const idx = i++
      results[idx] = await tasks[idx]()
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, () => run()))
  return results
}

export class SessionService {
  // In-memory index: profileId -> Set<sessionId>
  private profileIndex = new Map<string, Set<string>>()
  private indexBuilt = false
  // Per-session write lock to prevent concurrent read-modify-write races
  private writeLocks = new Map<string, Promise<unknown>>()

  constructor(private storage: StorageService) {}

  /** Serialize writes to the same session to prevent read-modify-write races. */
  private async withSessionLock<T>(sessionId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.writeLocks.get(sessionId) ?? Promise.resolve()
    const current = prev.then(fn, fn) // run fn even if previous rejected
    this.writeLocks.set(sessionId, current)
    try {
      return await current
    } finally {
      // Clean up lock entry if it's still ours (no newer write queued)
      if (this.writeLocks.get(sessionId) === current) {
        this.writeLocks.delete(sessionId)
      }
    }
  }

  // --- Meta helpers ---

  private async readMeta(id: string): Promise<SessionMeta | null> {
    return this.storage.readJSON<SessionMeta>('sessions', `${id}${META_EXT}`)
  }

  private async writeMeta(id: string, meta: SessionMeta): Promise<void> {
    await this.storage.writeJSON('sessions', `${id}${META_EXT}`, meta)
  }

  private async readMessages(id: string): Promise<Message[]> {
    return this.storage.readLines<Message>('sessions', id, MESSAGES_EXT)
  }

  /** Combine meta + messages into a full Session object. */
  private toSession(meta: SessionMeta, messages: Message[]): Session {
    return {
      id: meta.id,
      profileId: meta.profileId,
      title: meta.title,
      messages,
      adapterMeta: meta.adapterMeta,
      parentId: meta.parentId,
      forkPoint: meta.forkPoint,
      createdAt: meta.createdAt,
      updatedAt: meta.updatedAt,
      archived: meta.archived,
    }
  }

  // --- Index management ---

  /** Build the in-memory index by scanning all *.meta.json files once at startup. */
  async buildIndex(): Promise<void> {
    if (this.indexBuilt) return
    const dir = path.join(this.storage.basePath, 'sessions')
    let entries: string[]
    try { entries = await fs.readdir(dir) } catch { entries = [] }

    const metaFiles = entries.filter(f => f.endsWith('.meta.json') && !f.endsWith('.tmp'))

    // Concurrency-limited reads
    const tasks = metaFiles.map(file => () => {
      const id = file.replace('.meta.json', '')
      return this.readMeta(id)
    })
    const results = await parallelLimit(tasks, MAX_PARALLEL_READS)

    for (const meta of results) {
      if (meta) this.addToIndex(meta.profileId, meta.id)
    }
    this.indexBuilt = true
  }

  private addToIndex(profileId: string, sessionId: string): void {
    let set = this.profileIndex.get(profileId)
    if (!set) {
      set = new Set()
      this.profileIndex.set(profileId, set)
    }
    set.add(sessionId)
  }

  private removeFromIndex(profileId: string, sessionId: string): void {
    const set = this.profileIndex.get(profileId)
    if (set) {
      set.delete(sessionId)
      if (set.size === 0) this.profileIndex.delete(profileId)
    }
  }

  // --- CRUD operations ---

  async create(input: CreateSessionInput): Promise<Session> {
    const now = new Date().toISOString()
    const id = uuid()
    const meta: SessionMeta = {
      id,
      profileId: input.profileId,
      title: input.title,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
      archived: false,
    }
    await this.writeMeta(id, meta)
    // Create empty messages file
    const msgPath = path.join(this.storage.basePath, 'sessions', `${id}${MESSAGES_EXT}`)
    await fs.writeFile(msgPath, '', 'utf-8')
    this.addToIndex(meta.profileId, id)
    return this.toSession(meta, [])
  }

  async getById(id: string, opts?: { offset: number; limit: number }): Promise<Session | null> {
    const meta = await this.readMeta(id)
    if (!meta) return null

    let messages: Message[]
    if (opts && opts.limit > 0) {
      const result = await this.storage.readLinesPaginated<Message>('sessions', id, MESSAGES_EXT, opts.offset, opts.limit)
      messages = result.items
    } else {
      messages = await this.readMessages(id)
    }
    return this.toSession(meta, messages)
  }

  async listByProfile(profileId: string): Promise<Session[]> {
    // Ensure index is built (lazy init on first call)
    await this.buildIndex()

    const sessionIds = this.profileIndex.get(profileId)
    if (!sessionIds || sessionIds.size === 0) return []

    // Parallel read meta only (no messages) with concurrency limit
    const tasks = [...sessionIds].map(id => () => this.readMeta(id))
    const results = await parallelLimit(tasks, MAX_PARALLEL_READS)

    // Return Session objects with empty messages array — the route layer
    // already truncates messages for the list endpoint, so this is fine.
    return results
      .filter((m): m is SessionMeta => m !== null)
      .map(meta => this.toSession(meta, []))
  }

  async addMessage(sessionId: string, msg: { role: 'user' | 'assistant'; content: string; provider?: string; model?: string; durationMs?: number }, meta?: Record<string, unknown>): Promise<Session | null> {
    if (msg.content.length > 500_000) {
      throw new Error('Message content exceeds maximum length (500KB)')
    }
    return this.withSessionLock(sessionId, async () => {
      const sessionMeta = await this.readMeta(sessionId)
      if (!sessionMeta) return null

      const message: Message = {
        id: uuid(),
        role: msg.role,
        content: msg.content,
        timestamp: new Date().toISOString(),
        ...(msg.provider ? { provider: msg.provider } : {}),
        ...(msg.model ? { model: msg.model } : {}),
        ...(msg.durationMs != null ? { durationMs: msg.durationMs } : {}),
      }

      // O(1) append to JSONL
      await this.storage.appendLine('sessions', sessionId, MESSAGES_EXT, message)

      // Update meta
      sessionMeta.messageCount++
      if (meta && Object.keys(meta).length > 0) {
        sessionMeta.adapterMeta = { ...sessionMeta.adapterMeta, ...meta }
      }
      sessionMeta.updatedAt = new Date().toISOString()
      await this.writeMeta(sessionId, sessionMeta)

      // Return full session
      const messages = await this.readMessages(sessionId)
      return this.toSession(sessionMeta, messages)
    })
  }

  async archive(id: string): Promise<Session | null> {
    return this.withSessionLock(id, async () => {
      const meta = await this.readMeta(id)
      if (!meta) return null
      meta.archived = true
      meta.updatedAt = new Date().toISOString()
      await this.writeMeta(id, meta)
      const messages = await this.readMessages(id)
      return this.toSession(meta, messages)
    })
  }

  async updateMeta(id: string, adapterMeta: Record<string, unknown>): Promise<Session | null> {
    return this.withSessionLock(id, async () => {
      const meta = await this.readMeta(id)
      if (!meta) return null
      meta.adapterMeta = { ...meta.adapterMeta, ...adapterMeta }
      meta.updatedAt = new Date().toISOString()
      await this.writeMeta(id, meta)
      const messages = await this.readMessages(id)
      return this.toSession(meta, messages)
    })
  }

  async update(id: string, input: { title?: string }): Promise<Session | null> {
    return this.withSessionLock(id, async () => {
      const meta = await this.readMeta(id)
      if (!meta) return null
      if (input.title !== undefined) meta.title = input.title
      meta.updatedAt = new Date().toISOString()
      await this.writeMeta(id, meta)
      const messages = await this.readMessages(id)
      return this.toSession(meta, messages)
    })
  }

  async delete(id: string, knownProfileId?: string): Promise<void> {
    // Delete both files, then update index
    await Promise.all([
      this.storage.deleteJSON('sessions', `${id}${META_EXT}`),
      this.storage.deleteFile('sessions', id, MESSAGES_EXT),
    ])
    if (knownProfileId) {
      this.removeFromIndex(knownProfileId, id)
    } else {
      for (const [profileId, set] of this.profileIndex) {
        if (set.has(id)) {
          this.removeFromIndex(profileId, id)
          break
        }
      }
    }
  }

  async fork(sessionId: string, forkPoint: string, newContent: string): Promise<Session | null> {
    if (newContent.length > 500_000) {
      throw new Error('Message content exceeds maximum length (500KB)')
    }
    const originalMeta = await this.readMeta(sessionId)
    if (!originalMeta) return null
    const originalMessages = await this.readMessages(sessionId)

    // Find the forkPoint message index
    const idx = originalMessages.findIndex(m => m.id === forkPoint)
    if (idx === -1) return null

    // Keep messages up to (not including) the forkPoint, then add edited message
    const keptMessages = originalMessages.slice(0, idx)
    const editedMessage: Message = {
      id: uuid(),
      role: 'user',
      content: newContent,
      timestamp: new Date().toISOString(),
    }
    keptMessages.push(editedMessage)

    const now = new Date().toISOString()
    const forkedId = uuid()
    const forkedMeta: SessionMeta = {
      id: forkedId,
      profileId: originalMeta.profileId,
      title: originalMeta.title + ' (fork)',
      messageCount: keptMessages.length,
      adapterMeta: originalMeta.adapterMeta,
      parentId: sessionId,
      forkPoint,
      createdAt: now,
      updatedAt: now,
      archived: false,
    }
    await this.writeMeta(forkedId, forkedMeta)

    // Write all kept messages to JSONL
    const lines = keptMessages.map(m => JSON.stringify(m)).join('\n') + (keptMessages.length ? '\n' : '')
    const msgPath = path.join(this.storage.basePath, 'sessions', `${forkedId}${MESSAGES_EXT}`)
    await fs.writeFile(msgPath, lines, 'utf-8')

    this.addToIndex(forkedMeta.profileId, forkedId)
    return this.toSession(forkedMeta, keptMessages)
  }

  async deleteMessagesAfter(sessionId: string, msgId: string): Promise<Session | null> {
    return this.withSessionLock(sessionId, async () => {
      const meta = await this.readMeta(sessionId)
      if (!meta) return null
      const messages = await this.readMessages(sessionId)

      const idx = messages.findIndex(m => m.id === msgId)
      if (idx === -1) return null

      // Keep messages up to and including the target message
      const keepCount = idx + 1
      await this.storage.truncateLines('sessions', sessionId, MESSAGES_EXT, keepCount)

      meta.messageCount = keepCount
      meta.updatedAt = new Date().toISOString()
      await this.writeMeta(sessionId, meta)

      return this.toSession(meta, messages.slice(0, keepCount))
    })
  }

  async deleteByProfile(profileId: string): Promise<void> {
    const sessions = await this.listByProfile(profileId)
    await Promise.all(sessions.map(s => this.delete(s.id, profileId)))
  }
}
