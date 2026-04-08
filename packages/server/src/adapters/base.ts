import type { Message } from '@chat-deck/shared'
import type { CLIAdapter, SendMessageOptions, ModelInfo, AdapterError } from './types.js'
import type { ConfigService } from '../services/config.js'
import { parseSSEStream } from './sse-parser.js'
import { checkCommandInstalled, spawnCLI } from './cli-utils.js'
import { buildConversationPrompt } from './prompt-utils.js'

export interface ApiRequest {
  url: string
  headers: Record<string, string>
  body: string
}

export abstract class BaseAdapter implements CLIAdapter {
  abstract name: string
  abstract displayName: string
  abstract models: ModelInfo[]
  abstract defaultModel: string
  abstract apiKeyName: string | null
  command: string = ''

  protected config: ConfigService

  constructor(config: ConfigService) {
    this.config = config
  }

  abstract buildApiRequest(messages: Message[], systemPrompt: string, model: string): ApiRequest
  abstract parseStreamChunk(data: Record<string, unknown>): string | null

  formatMessages(messages: Message[]): Array<{ role: string; content: string }> {
    return messages.map(m => ({ role: m.role, content: m.content }))
  }

  getApiKey(): string | undefined {
    if (!this.apiKeyName) return undefined
    return process.env[this.envKeyName()] || this.config.getApiKey(this.apiKeyName)
  }

  protected envKeyName(): string {
    if (!this.apiKeyName) return ''
    return this.apiKeyName.toUpperCase() + '_API_KEY'
  }

  async checkInstalled(): Promise<boolean> {
    if (this.getApiKey()) return true
    if (this.command) return checkCommandInstalled(this.command)
    return false
  }

  sendMessage(opts: SendMessageOptions): { abort: () => void } {
    const apiKey = this.getApiKey()
    const model = opts.model || this.defaultModel

    if (apiKey) {
      return this.sendViaAPI(opts, apiKey, model)
    }
    if (this.command) {
      return this.sendViaCLI(opts)
    }

    const err: AdapterError = {
      code: 'NO_API_KEY',
      message: `No API key configured for ${this.displayName}`,
      provider: this.name,
      suggestion: this.apiKeyName
        ? `Add your ${this.apiKeyName.toUpperCase()}_API_KEY in Settings`
        : `Install the ${this.command} CLI`,
    }
    opts.onError(new Error(`${err.message}. ${err.suggestion}`))
    return { abort: () => {} }
  }

  protected sendViaAPI(opts: SendMessageOptions, apiKey: string, model: string): { abort: () => void } {
    const controller = new AbortController()
    const req = this.buildApiRequest(opts.messages, opts.systemPrompt, model)

    const run = async () => {
      try {
        const res = await fetch(req.url, {
          method: 'POST',
          headers: req.headers,
          body: req.body,
          signal: controller.signal,
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`${this.displayName} API error ${res.status}: ${text.slice(0, 300)}`)
        }
        await parseSSEStream(res, (_event, data) => {
          if (data === '[DONE]') return
          try {
            const parsed = JSON.parse(data)
            const text = this.parseStreamChunk(parsed)
            if (text) opts.onChunk(text)
          } catch { /* skip unparseable chunks */ }
        })
        if (!controller.signal.aborted) {
          await opts.onDone({ mode: 'api', model })
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          opts.onError(err instanceof Error ? err : new Error(String(err)))
        }
      }
    }
    run()
    return { abort: () => controller.abort() }
  }

  protected sendViaCLI(opts: SendMessageOptions): { abort: () => void } {
    const prompt = buildConversationPrompt(opts.systemPrompt, opts.messages)
    return spawnCLI(this.command, [prompt], {
      onChunk: opts.onChunk,
      onDone: () => opts.onDone({ mode: 'cli' }),
      onError: opts.onError,
    })
  }
}
