import { Router } from 'express'
import type { AdapterRegistry } from '../adapters/registry.js'
import type { ConfigService } from '../services/config.js'

export function createProviderRoutes(registry: AdapterRegistry, config: ConfigService): Router {
  const router = Router()
  router.get('/', async (_req, res) => {
    try {
      const providers = await registry.listProviders()
      // Add enabled status from config
      const result = providers.map(p => ({
        ...p,
        enabled: config.isProviderEnabled(p.name),
      }))
      res.json(result)
    } catch {
      res.status(500).json({ error: 'Internal server error' })
    }
  })
  return router
}
