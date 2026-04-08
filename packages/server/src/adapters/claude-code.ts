import type { Message } from '@chat-deck/shared'
import { BaseAdapter, type ApiRequest } from './base.js'
import type { ModelInfo, SendMessageOptions } from './types.js'
import type { ConfigService } from '../services/config.js'
import { spawnCLI } from './cli-utils.js'

export class ClaudeCodeAdapter extends BaseAdapter {
  name = 'claude-code'
  displayName = 'Claude'
  command = 'claude'
  apiKeyName = 'anthropic'
  models: ModelInfo[] = [
    { id: 'claude-sonnet-4-20250514', name: 'Sonnet 4' },
    { id: 'claude-opus-4-20250514', name: 'Opus 4' },
    { id: 'claude-haiku-4-20250514', name: 'Haiku 4' },
  ]
  defaultModel = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514'

  constructor(config: ConfigService) { super(config) }

  protected envKeyName(): string { return 'ANTHROPIC_API_KEY' }

  buildApiRequest(messages: Message[], systemPrompt: string, model: string): ApiRequest {
    const apiKey = this.getApiKey()!
    return {
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model, max_tokens: 8192, system: systemPrompt,
        messages: this.formatMessages(messages), stream: true,
      }),
    }
  }

  parseStreamChunk(data: Record<string, unknown>): string | null {
    if (data.type !== 'content_block_delta') return null
    const delta = data.delta as { text?: string } | undefined
    return delta?.text || null
  }

  /** Use claude CLI flags (--system-prompt, -p) instead of embedding system prompt in the text. */
  protected sendViaCLI(opts: SendMessageOptions): { abort: () => void } {
    const args = ['-p', '--output-format', 'text']
    if (opts.systemPrompt) {
      args.push('--system-prompt', opts.systemPrompt)
    }
    // Build user prompt: single message or multi-turn history
    const messages = opts.messages
    let prompt: string
    if (messages.length === 1) {
      prompt = messages[0].content
    } else {
      const history = messages.slice(0, -1)
        .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
        .join('\n')
      prompt = `Previous conversation:\n${history}\n\n${messages[messages.length - 1].content}`
    }
    args.push(prompt)
    return spawnCLI(this.command, args, {
      onChunk: opts.onChunk,
      onDone: () => opts.onDone({ mode: 'cli' }),
      onError: opts.onError,
    })
  }
}
