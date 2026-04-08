import { Router } from 'express'
import type { ConfigService } from '../services/config.js'
import type { AdapterRegistry } from '../adapters/registry.js'
import { asyncHandler } from './async-handler.js'

export function createConfigRoutes(config: ConfigService, registry: AdapterRegistry): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    res.json(config.getMasked())
  })

  router.put('/api-keys', asyncHandler(async (req, res) => {
    const keys = req.body
    if (!keys || typeof keys !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' })
    }
    await config.updateApiKeys(keys)
    await registry.buildProviderCache()
    res.json(config.getMasked())
  }))

  router.put('/enabled-providers', asyncHandler(async (req, res) => {
    const enabled = req.body
    if (!enabled || typeof enabled !== 'object') {
      return res.status(400).json({ error: 'Invalid request body' })
    }
    await config.updateEnabledProviders(enabled)
    res.json(config.getMasked())
  }))

  // POST /api/config/test/:provider — test if a provider is reachable
  router.post('/test/:provider', asyncHandler(async (req, res) => {
    const { provider } = req.params
    const adapter = registry.get(provider)
    if (!adapter) {
      return res.json({ ok: false, error: 'Provider not found' })
    }

    const start = Date.now()
    try {
      const result = await new Promise<{ ok: boolean; mode: string; time: number; error?: string }>((resolve) => {
        const timeout = setTimeout(() => {
          handle.abort()
          resolve({ ok: false, mode: 'timeout', time: Date.now() - start, error: 'Timeout (30s)' })
        }, 30_000)

        const handle = adapter.sendMessage({
          systemPrompt: 'Reply with exactly: OK',
          messages: [{ id: 'test', role: 'user', content: 'hi', timestamp: new Date().toISOString() }],
          onChunk: () => {},
          onDone: (meta) => {
            clearTimeout(timeout)
            resolve({ ok: true, mode: (meta?.mode as string) || 'unknown', time: Date.now() - start })
          },
          onError: (err) => {
            clearTimeout(timeout)
            resolve({ ok: false, mode: 'error', time: Date.now() - start, error: err.message })
          },
        })
      })
      res.json(result)
    } catch (err) {
      res.json({ ok: false, mode: 'error', time: Date.now() - start, error: err instanceof Error ? err.message : 'Unknown error' })
    }
  }))

  return router
}
