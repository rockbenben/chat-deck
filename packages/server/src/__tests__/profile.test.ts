import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { StorageService } from '../services/storage.js'
import { ProfileService } from '../services/profile.js'

let storage: StorageService
let profiles: ProfileService
let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-deck-profile-test-'))
  storage = new StorageService(tmpDir)
  await storage.init()
  profiles = new ProfileService(storage)
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('ProfileService', () => {
  it('creates a profile with id and timestamps', async () => {
    const profile = await profiles.create({
      name: 'Test Profile',
      systemPrompt: 'You are a helpful assistant.',
      cliProvider: 'claude',
      icon: '🤖',
    })
    expect(profile.id).toBeDefined()
    expect(profile.name).toBe('Test Profile')
    expect(profile.systemPrompt).toBe('You are a helpful assistant.')
    expect(profile.cliProvider).toBe('claude')
    expect(profile.icon).toBe('🤖')
    expect(profile.createdAt).toBeDefined()
    expect(profile.updatedAt).toBeDefined()
  })

  it('lists all profiles', async () => {
    await profiles.create({ name: 'Alice', systemPrompt: 'Prompt A', cliProvider: 'claude' })
    await profiles.create({ name: 'Bob', systemPrompt: 'Prompt B', cliProvider: 'codex' })
    const list = await profiles.list()
    expect(list).toHaveLength(2)
    expect(list.map((p) => p.name).sort()).toEqual(['Alice', 'Bob'])
  })

  it('gets a profile by id', async () => {
    const created = await profiles.create({ name: 'Charlie', systemPrompt: 'Prompt C', cliProvider: 'gemini' })
    const found = await profiles.getById(created.id)
    expect(found).toEqual(created)
  })

  it('returns null for non-existent id', async () => {
    const result = await profiles.getById('does-not-exist')
    expect(result).toBeNull()
  })

  it('updates a profile', async () => {
    const created = await profiles.create({ name: 'Dave', systemPrompt: 'Prompt D', cliProvider: 'claude' })
    const updated = await profiles.update(created.id, { name: 'Dave Updated' })
    expect(updated).not.toBeNull()
    expect(updated!.name).toBe('Dave Updated')
    expect(updated!.systemPrompt).toBe('Prompt D')
    expect(updated!.updatedAt).not.toBe(created.updatedAt)
  })

  it('deletes a profile', async () => {
    const created = await profiles.create({ name: 'Eve', systemPrompt: 'Prompt E', cliProvider: 'claude' })
    await profiles.delete(created.id)
    const result = await profiles.getById(created.id)
    expect(result).toBeNull()
  })
})
