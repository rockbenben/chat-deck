import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { StorageService } from '../services/storage.js'

let storage: StorageService
let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-deck-test-'))
  storage = new StorageService(tmpDir)
  await storage.init()
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('StorageService', () => {
  it('creates data directories on init', async () => {
    const profilesDir = path.join(tmpDir, 'profiles')
    const sessionsDir = path.join(tmpDir, 'sessions')
    expect((await fs.stat(profilesDir)).isDirectory()).toBe(true)
    expect((await fs.stat(sessionsDir)).isDirectory()).toBe(true)
  })

  it('writes and reads a JSON file', async () => {
    const data = { id: '123', name: 'test' }
    await storage.writeJSON('profiles', '123', data)
    const result = await storage.readJSON('profiles', '123')
    expect(result).toEqual(data)
  })

  it('lists all files in a subdirectory', async () => {
    await storage.writeJSON('profiles', 'a', { id: 'a' })
    await storage.writeJSON('profiles', 'b', { id: 'b' })
    const items = await storage.listJSON('profiles')
    expect(items).toHaveLength(2)
    expect((items as { id: string }[]).map((i) => i.id).sort()).toEqual(['a', 'b'])
  })

  it('deletes a JSON file', async () => {
    await storage.writeJSON('profiles', '123', { id: '123' })
    await storage.deleteJSON('profiles', '123')
    const result = await storage.readJSON('profiles', '123')
    expect(result).toBeNull()
  })

  it('returns null for non-existent file', async () => {
    const result = await storage.readJSON('profiles', 'nonexistent')
    expect(result).toBeNull()
  })
})
