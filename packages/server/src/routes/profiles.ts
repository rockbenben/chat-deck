import { Router } from 'express'
import type { ProfileService } from '../services/profile.js'
import type { SessionService } from '../services/session.js'
import { asyncHandler } from './async-handler.js'

export function createProfileRoutes(profiles: ProfileService, sessions: SessionService): Router {
  const router = Router()

  router.get('/', asyncHandler(async (_req, res) => {
    const list = await profiles.list()
    res.json(list)
  }))

  router.get('/:id', asyncHandler(async (req, res) => {
    const profile = await profiles.getById(req.params.id)
    if (!profile) return res.status(404).json({ error: 'Profile not found' })
    res.json(profile)
  }))

  router.post('/', asyncHandler(async (req, res) => {
    const { name, systemPrompt, cliProvider, icon, stateless } = req.body

    const errors: string[] = []
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      errors.push('name is required and must be a non-empty string')
    }
    if (!systemPrompt || typeof systemPrompt !== 'string' || systemPrompt.trim().length === 0) {
      errors.push('systemPrompt is required and must be a non-empty string')
    }
    if (!cliProvider || typeof cliProvider !== 'string' || cliProvider.trim().length === 0) {
      errors.push('cliProvider is required and must be a non-empty string')
    }
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') })
    }

    const profile = await profiles.create({ name, systemPrompt, cliProvider, icon, stateless })
    res.status(201).json(profile)
  }))

  router.put('/:id', asyncHandler(async (req, res) => {
    // Only allow known mutable fields — prevent overwriting id/createdAt
    const { name, systemPrompt, cliProvider, icon, stateless } = req.body
    const updated = await profiles.update(req.params.id, { name, systemPrompt, cliProvider, icon, stateless })
    if (!updated) return res.status(404).json({ error: 'Profile not found' })
    res.json(updated)
  }))

  router.delete('/:id', asyncHandler(async (req, res) => {
    await sessions.deleteByProfile(req.params.id)
    await profiles.delete(req.params.id)
    res.status(204).send()
  }))

  return router
}
