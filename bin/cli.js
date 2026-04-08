#!/usr/bin/env node

import { parseArgs } from 'node:util'
import { execSync } from 'node:child_process'

const { values } = parseArgs({
  options: {
    port: { type: 'string', short: 'p', default: '3456' },
    'data-dir': { type: 'string', short: 'd' },
    'no-open': { type: 'boolean', default: false },
  },
})

const port = parseInt(values.port, 10)
if (isNaN(port) || port < 1 || port > 65535) {
  console.error(`Invalid port: ${values.port}`)
  process.exit(1)
}

process.env.PORT = String(port)
if (values['data-dir']) process.env.CHAT_DECK_DATA_DIR = values['data-dir']
process.env.NODE_ENV = 'production'

if (!values['no-open']) {
  setTimeout(() => {
    const url = `http://localhost:${port}`
    const cmd = process.platform === 'win32' ? `start ${url}`
      : process.platform === 'darwin' ? `open ${url}` : `xdg-open ${url}`
    try { execSync(cmd, { stdio: 'ignore' }) } catch {}
  }, 1500)
}

await import('../packages/server/dist/index.js')
