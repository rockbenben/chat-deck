import type { Message } from '@chat-deck/shared'
import { BaseAdapter, type ApiRequest } from './base.js'
import type { ModelInfo } from './types.js'
import type { ConfigService } from '../services/config.js'

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
}
