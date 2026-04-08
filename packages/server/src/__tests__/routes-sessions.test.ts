import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import express from 'express'
import request from 'supertest'
import { StorageService } from '../services/storage.js'
import { SessionService } from '../services/session.js'
import { createSessionRoutes } from '../routes/sessions.js'

let app: express.Express
let tmpDir: string

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'chat-deck-test-'))
  const storage = new StorageService(tmpDir)
  await storage.init()
  const sessions = new SessionService(storage)
  app = express()
  app.use(express.json())
  app.use('/api/sessions', createSessionRoutes(sessions))
})

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true })
})

describe('Session Routes', () => {
  it('POST /api/sessions creates a session', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .send({ profileId: 'p1', title: 'New Chat' })
    expect(res.status).toBe(201)
    expect(res.body.profileId).toBe('p1')
    expect(res.body.messages).toEqual([])
  })

  it('GET /api/sessions?profileId=x lists sessions', async () => {
    await request(app).post('/api/sessions').send({ profileId: 'p1', title: 'A' })
    await request(app).post('/api/sessions').send({ profileId: 'p1', title: 'B' })
    const res = await request(app).get('/api/sessions?profileId=p1')
    expect(res.status).toBe(200)
    expect(res.body).toHaveLength(2)
  })

  it('GET /api/sessions/:id returns a session with messages', async () => {
    const created = await request(app).post('/api/sessions').send({ profileId: 'p1', title: 'X' })
    const res = await request(app).get(`/api/sessions/${created.body.id}`)
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('X')
  })

  it('PUT /api/sessions/:id updates title', async () => {
    const created = await request(app).post('/api/sessions').send({ profileId: 'p1', title: 'Old' })
    const res = await request(app).put(`/api/sessions/${created.body.id}`).send({ title: 'New' })
    expect(res.status).toBe(200)
    expect(res.body.title).toBe('New')
  })

  it('DELETE /api/sessions/:id archives the session', async () => {
    const created = await request(app).post('/api/sessions').send({ profileId: 'p1', title: 'Del' })
    const res = await request(app).delete(`/api/sessions/${created.body.id}`)
    expect(res.status).toBe(200)
    expect(res.body.archived).toBe(true)
  })
})
