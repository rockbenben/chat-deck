import { Router } from 'express'
import type { SessionService } from '../services/session.js'
import { sessionToMarkdown } from '../services/export.js'
import { asyncHandler } from './async-handler.js'

export function createSessionRoutes(sessions: SessionService): Router {
  const router = Router()

  router.get('/', asyncHandler(async (req, res) => {
    const profileId = req.query.profileId as string
    if (!profileId) return res.status(400).json({ error: 'profileId query param required' })
    const list = await sessions.listByProfile(profileId)
    const search = (req.query.search as string || '').toLowerCase()
    const filtered = search
      ? list.filter(s => s.title.toLowerCase().includes(search))
      : list
    // Lightweight list response: meta-only (messages are split into JSONL)
    const summaries = filtered.map(s => ({
      id: s.id,
      profileId: s.profileId,
      title: s.title,
      messages: s.messages, // empty array from listByProfile
      messageCount: s.messages.length, // 0 in list; real count available via getById
      parentId: s.parentId,
      forkPoint: s.forkPoint,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      archived: s.archived,
    }))
    res.json(summaries)
  }))

  router.get('/:id', asyncHandler(async (req, res) => {
    const offset = parseInt(req.query.offset as string) || 0
    const limit = parseInt(req.query.limit as string) || 0
    const session = limit > 0
      ? await sessions.getById(req.params.id, { offset, limit })
      : await sessions.getById(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    res.json(session)
  }))

  router.post('/', asyncHandler(async (req, res) => {
    const { profileId, title } = req.body
    if (!profileId || typeof profileId !== 'string') {
      return res.status(400).json({ error: 'profileId is required' })
    }
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'title is required' })
    }
    const session = await sessions.create({ profileId, title })
    res.status(201).json(session)
  }))

  router.put('/:id', asyncHandler(async (req, res) => {
    const { title } = req.body
    if (title !== undefined && typeof title !== 'string') {
      return res.status(400).json({ error: 'title must be a string' })
    }
    const updated = await sessions.update(req.params.id, { title })
    if (!updated) return res.status(404).json({ error: 'Session not found' })
    res.json(updated)
  }))

  router.post('/:id/archive', asyncHandler(async (req, res) => {
    const archived = await sessions.archive(req.params.id)
    if (!archived) return res.status(404).json({ error: 'Session not found' })
    res.json(archived)
  }))

  router.get('/:id/export', asyncHandler(async (req, res) => {
    const session = await sessions.getById(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    const format = req.query.format as string || 'markdown'
    if (format !== 'markdown') return res.status(400).json({ error: 'Only markdown format supported' })
    const md = sessionToMarkdown(session)
    const safeName = session.title.replace(/[/\\:*?"<>|]/g, '_')
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeName)}.md`)
    res.send(md)
  }))

  router.post('/:id/fork', asyncHandler(async (req, res) => {
    const { forkPoint, newContent } = req.body
    if (!forkPoint || !newContent) return res.status(400).json({ error: 'forkPoint and newContent required' })
    const forked = await sessions.fork(req.params.id, forkPoint, newContent)
    if (!forked) return res.status(404).json({ error: 'Session or message not found' })
    res.status(201).json(forked)
  }))

  router.delete('/:id/messages-after/:msgId', asyncHandler(async (req, res) => {
    const updated = await sessions.deleteMessagesAfter(req.params.id, req.params.msgId)
    if (!updated) return res.status(404).json({ error: 'Session or message not found' })
    res.json(updated)
  }))

  router.delete('/:id', asyncHandler(async (req, res) => {
    await sessions.delete(req.params.id)
    res.status(204).send()
  }))

  return router
}
