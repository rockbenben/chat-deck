import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { StorageService } from '../services/storage.js'
import { ProfileService } from '../services/profile.js'
import { SessionService } from '../services/session.js'
import { createProfileRoutes } from '../routes/profiles.js'

let app: express.Express
let storage: StorageService
let profiles: ProfileService
let sessions: SessionService
let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-deck-routes-test-'))
  storage = new StorageService(tmpDir)
  await storage.init()
  profiles = new ProfileService(storage)
  sessions = new SessionService(storage)
  await sessions.buildIndex()

  app = express()
  app.use(express.json())
  app.use('/api/profiles', createProfileRoutes(profiles, sessions))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('POST /api/profiles', () => {
  it('creates a profile and returns 201', async () => {
    const res = await request(app).post('/api/profiles').send({
      name: 'My Profile',
      systemPrompt: 'You are helpful.',
      cliProvider: 'claude',
    })
    expect(res.status).toBe(201)
    expect(res.body.id).toBeDefined()
    expect(res.body.name).toBe('My Profile')
  })
})

describe('GET /api/profiles', () => {
  it('returns list of profiles', async () => {
    await profiles.create({ name: 'P1', systemPrompt: 'S1', cliProvider: 'claude' })
    await profiles.create({ name: 'P2', systemPrompt: 'S2', cliProvider: 'codex' })
    const res = await request(app).get('/api/profiles')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })
})

describe('GET /api/profiles/:id', () => {
  it('returns a profile by id with 200', async () => {
    const created = await profiles.create({ name: 'Target', systemPrompt: 'T', cliProvider: 'claude' })
    const res = await request(app).get(`/api/profiles/${created.id}`)
    expect(res.status).toBe(200)
    expect(res.body.id).toBe(created.id)
    expect(res.body.name).toBe('Target')
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/profiles/nonexistent-id')
    expect(res.status).toBe(404)
    expect(res.body.error).toBe('Profile not found')
  })
})

describe('PUT /api/profiles/:id', () => {
  it('updates a profile and returns 200', async () => {
    const created = await profiles.create({ name: 'Old Name', systemPrompt: 'Old', cliProvider: 'claude' })
    const res = await request(app).put(`/api/profiles/${created.id}`).send({ name: 'New Name' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('New Name')
    expect(res.body.systemPrompt).toBe('Old')
  })
})

describe('DELETE /api/profiles/:id', () => {
  it('deletes a profile and returns 204', async () => {
    const created = await profiles.create({ name: 'ToDelete', systemPrompt: 'X', cliProvider: 'claude' })
    const res = await request(app).delete(`/api/profiles/${created.id}`)
    expect(res.status).toBe(204)
    const check = await profiles.getById(created.id)
    expect(check).toBeNull()
  })
})
