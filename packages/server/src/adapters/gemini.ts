import type { Message } from '@chat-deck/shared'
import { BaseAdapter, type ApiRequest } from './base.js'
import type { ModelInfo } from './types.js'
import type { ConfigService } from '../services/config.js'

export class GeminiAdapter extends BaseAdapter {
  name = 'gemini'
  displayName = 'Gemini'
  command = ''
  apiKeyName = 'gemini'
  models: ModelInfo[] = [
    { id: 'gemini-2.5-flash', name: '2.5 Flash' },
    { id: 'gemini-2.5-pro', name: '2.5 Pro' },
  ]
  defaultModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash'

  constructor(config: ConfigService) { super(config) }
  protected envKeyName(): string { return 'GEMINI_API_KEY' }

  getApiKey(): string | undefined {
    return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || this.config.getApiKey('gemini')
  }

  buildApiRequest(messages: Message[], systemPrompt: string, model: string): ApiRequest {
    const apiKey = this.getApiKey()!
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
      headers: { 'Content-Type': 'application/json', 'X-goog-api-key': apiKey },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
      }),
    }
  }

  parseStreamChunk(data: Record<string, unknown>): string | null {
    const candidates = data.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined
    return candidates?.[0]?.content?.parts?.[0]?.text || null
  }
}
