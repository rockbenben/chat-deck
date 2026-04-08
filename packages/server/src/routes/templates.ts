import { Router } from 'express'
import type { TemplateService } from '../services/template.js'
import { asyncHandler } from './async-handler.js'

export function createTemplateRoutes(templates: TemplateService): Router {
  const router = Router()

  router.get('/', asyncHandler(async (_req, res) => {
    const list = await templates.list()
    res.json(list)
  }))

  router.get('/:id', asyncHandler(async (req, res) => {
    const tmpl = await templates.getById(req.params.id)
    if (!tmpl) return res.status(404).json({ error: 'Template not found' })
    res.json(tmpl)
  }))

  router.post('/', asyncHandler(async (req, res) => {
    const { name, description, systemPrompt, firstMessage, category } = req.body
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' })
    }
    if (!systemPrompt || typeof systemPrompt !== 'string' || !systemPrompt.trim()) {
      return res.status(400).json({ error: 'systemPrompt is required' })
    }
    const tmpl = await templates.create({ name, description: description || '', systemPrompt, firstMessage: firstMessage || '', category: category || '' })
    res.status(201).json(tmpl)
  }))

  router.put('/:id', asyncHandler(async (req, res) => {
    const { name, description, systemPrompt, firstMessage, category } = req.body
    const updated = await templates.update(req.params.id, { name, description, systemPrompt, firstMessage, category })
    if (!updated) return res.status(404).json({ error: 'Template not found' })
    res.json(updated)
  }))

  router.delete('/:id', asyncHandler(async (req, res) => {
    await templates.delete(req.params.id)
    res.status(204).send()
  }))

  return router
}
