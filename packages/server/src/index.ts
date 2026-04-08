import express from 'express'
import cors from 'cors'
import http from 'http'
import { WebSocketServer, WebSocket } from 'ws'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'
import { watch } from 'chokidar'

import { StorageService } from './services/storage.js'
import { ProfileService } from './services/profile.js'
import { SessionService } from './services/session.js'
import { AdapterRegistry } from './adapters/registry.js'
import { ClaudeCodeAdapter } from './adapters/claude-code.js'
import { CodexAdapter } from './adapters/codex.js'
import { GeminiAdapter } from './adapters/gemini.js'
import { QwenAdapter } from './adapters/qwen.js'
import { DeepSeekAdapter } from './adapters/deepseek.js'
import { GroqAdapter } from './adapters/groq.js'
import { OllamaAdapter } from './adapters/ollama.js'
import { migrateSessionsIfNeeded } from './services/migration.js'
import { ChatHandler } from './ws/chat.js'
import { createProfileRoutes } from './routes/profiles.js'
import { createSessionRoutes } from './routes/sessions.js'
import { createProviderRoutes } from './routes/providers.js'
import { TemplateService } from './services/template.js'
import { createTemplateRoutes } from './routes/templates.js'
import { ConfigService } from './services/config.js'
import { createConfigRoutes } from './routes/config.js'

const PORT = parseInt(process.env.PORT || '3456', 10)
if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`Invalid PORT: ${process.env.PORT}. Must be 1-65535.`)
  process.exit(1)
}
const DATA_DIR = process.env.CHAT_DECK_DATA_DIR || path.join(os.homedir(), '.chat-deck')
const MAX_WS_PAYLOAD = 1024 * 1024 // 1 MB

async function main() {
  const storage = new StorageService(DATA_DIR)
  await storage.init()
  const configService = new ConfigService(DATA_DIR)
  await configService.load()
  const profileService = new ProfileService(storage)
  const sessionService = new SessionService(storage)

  const registry = new AdapterRegistry()
  registry.register(new ClaudeCodeAdapter(configService))
  registry.register(new CodexAdapter(configService))
  registry.register(new GeminiAdapter(configService))
  registry.register(new QwenAdapter(configService))
  registry.register(new DeepSeekAdapter(configService))
  registry.register(new GroqAdapter(configService))
  registry.register(new OllamaAdapter(configService))

  const templateService = new TemplateService(storage)
  const chatHandler = new ChatHandler(sessionService, profileService, registry)

  const app = express()
  app.use(cors({ origin: /^https?:\/\/localhost(:\d+)?$/ }))
  app.use(express.json({ limit: '1mb' }))

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() })
  })

  app.use('/api/profiles', createProfileRoutes(profileService, sessionService))
  app.use('/api/sessions', createSessionRoutes(sessionService))
  app.use('/api/providers', createProviderRoutes(registry, configService))
  app.use('/api/templates', createTemplateRoutes(templateService))
  app.use('/api/config', createConfigRoutes(configService, registry))

  const isDev = process.env.NODE_ENV !== 'production'

  // NOTE: Vite middleware MUST be added AFTER all /api routes
  if (isDev) {
    const { createServer: createViteServer } = await import('vite')
    const clientRoot = path.join(import.meta.dirname, '../../client')
    const vite = await createViteServer({
      root: clientRoot,
      server: { middlewareMode: true },
    })
    app.use(vite.middlewares)
    // SPA fallback: Vite middleware mode doesn't serve index.html
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/ws')) return next()
      try {
        let html = await fs.readFile(path.join(clientRoot, 'index.html'), 'utf-8')
        html = await vite.transformIndexHtml(req.originalUrl, html)
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html)
      } catch (e) {
        vite.ssrFixStacktrace(e as Error)
        next(e)
      }
    })
  } else {
    const clientDist = path.join(import.meta.dirname, '../../client/dist')
    app.use(express.static(clientDist, { maxAge: '1h' }))
    app.get('*', (_req, res, next) => {
      if (_req.path.startsWith('/api') || _req.path.startsWith('/ws')) return next()
      res.sendFile(path.join(clientDist, 'index.html'), (err) => { if (err) next() })
    })
  }

  const server = http.createServer(app)
  const wss = new WebSocketServer({
    server,
    path: '/ws/chat',
    maxPayload: MAX_WS_PAYLOAD,
    verifyClient: (info: { origin?: string }) => /^https?:\/\/localhost(:\d+)?$/.test(info.origin || ''),
  })

  // WS heartbeat: detect dead connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ((ws as any).__alive === false) { ws.terminate(); return }
      (ws as any).__alive = false
      ws.ping()
    })
  }, 30_000)

  wss.on('connection', (ws: WebSocket) => {
    (ws as any).__alive = true
    ws.on('pong', () => { (ws as any).__alive = true })

    ws.on('message', async (raw: Buffer) => {
      let msg: any
      try {
        msg = JSON.parse(raw.toString())
      } catch {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }))
        }
        return
      }
      if (!msg || typeof msg.type !== 'string') {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', error: 'Missing message type' }))
        }
        return
      }
      try {
        await chatHandler.handleMessage(ws, msg)
      } catch (err) {
        console.error('[WS handler error]', err)
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'error', sessionId: msg.sessionId, error: 'Internal server error' }))
        }
      }
    })

    ws.on('close', () => chatHandler.cleanupConnection(ws))
  })

  const profilesDir = path.join(DATA_DIR, 'profiles')
  const watcher = watch(profilesDir, { ignoreInitial: true })
  let broadcastTimer: ReturnType<typeof setTimeout> | null = null
  const debouncedBroadcast = () => {
    if (broadcastTimer) return
    broadcastTimer = setTimeout(() => {
      broadcastTimer = null
      const notification = JSON.stringify({ type: 'profiles-changed' })
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) client.send(notification)
      })
    }, 100)
  }
  watcher.on('change', debouncedBroadcast)
  watcher.on('add', debouncedBroadcast)
  watcher.on('unlink', debouncedBroadcast)

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down...')
    clearInterval(heartbeatInterval)
    watcher.close()
    wss.clients.forEach((ws) => ws.close(1001, 'Server shutting down'))
    wss.close()
    if (broadcastTimer) clearTimeout(broadcastTimer)
    server.close(() => process.exit(0))
    const forceExit = setTimeout(() => process.exit(1), 5000)
    forceExit.unref() // Don't keep process alive just for force-exit timer
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\nPort ${PORT} is already in use.\nUse --port to specify a different port: chat-deck --port 8080\n`)
    } else if (err.code === 'EACCES') {
      console.error(`\nPermission denied for port ${PORT}.\nTry a port above 1024 or run with elevated privileges.\n`)
    } else {
      console.error('\nFailed to start server:', err.message)
    }
    process.exit(1)
  })

  server.listen(PORT, () => {
    console.log(`ChatDeck server running at http://localhost:${PORT}`)
    console.log(`Data directory: ${DATA_DIR}`)
    // Migrate old sessions, then build indexes — don't block startup
    migrateSessionsIfNeeded(storage)
      .then(() => sessionService.buildIndex())
      .catch(() => {})
    registry.buildProviderCache().catch(() => {})
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
