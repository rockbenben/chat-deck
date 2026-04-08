import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { StorageService } from '../services/storage.js'
import { SessionService } from '../services/session.js'

let storage: StorageService
let sessions: SessionService
let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-deck-test-'))
  storage = new StorageService(tmpDir)
  await storage.init()
  sessions = new SessionService(storage)
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('SessionService', () => {
  it('creates a session with empty messages', async () => {
    const session = await sessions.create({ profileId: 'p1', title: 'Test Session' })
    expect(session.id).toBeDefined()
    expect(session.profileId).toBe('p1')
    expect(session.title).toBe('Test Session')
    expect(session.messages).toEqual([])
    expect(session.archived).toBe(false)
  })

  it('lists sessions filtered by profileId', async () => {
    await sessions.create({ profileId: 'p1', title: 'A' })
    await sessions.create({ profileId: 'p1', title: 'B' })
    await sessions.create({ profileId: 'p2', title: 'C' })
    const list = await sessions.listByProfile('p1')
    expect(list).toHaveLength(2)
    expect(list.every(s => s.profileId === 'p1')).toBe(true)
  })

  it('adds a message to a session', async () => {
    const session = await sessions.create({ profileId: 'p1', title: 'Chat' })
    const updated = await sessions.addMessage(session.id, { role: 'user', content: 'Hello' })
    expect(updated!.messages).toHaveLength(1)
    expect(updated!.messages[0].role).toBe('user')
    expect(updated!.messages[0].content).toBe('Hello')
    expect(updated!.messages[0].id).toBeDefined()
  })

  it('archives a session', async () => {
    const session = await sessions.create({ profileId: 'p1', title: 'Arch' })
    const archived = await sessions.archive(session.id)
    expect(archived!.archived).toBe(true)
  })

  it('updates adapter metadata', async () => {
    const session = await sessions.create({ profileId: 'p1', title: 'Meta' })
    const updated = await sessions.updateMeta(session.id, { claudeSessionId: 'abc123' })
    expect(updated!.adapterMeta).toEqual({ claudeSessionId: 'abc123' })
  })
})
