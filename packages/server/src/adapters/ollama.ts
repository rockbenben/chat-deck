import { OpenAICompatAdapter } from './openai-compat.js'
import type { ApiRequest } from './base.js'
import type { Message } from '@chat-deck/shared'
import type { ModelInfo } from './types.js'
import type { ConfigService } from '../services/config.js'

export class OllamaAdapter extends OpenAICompatAdapter {
  name = 'ollama'
  displayName = 'Ollama'
  command = 'ollama'
  apiKeyName = null as unknown as string
  apiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434/v1/chat/completions'
  models: ModelInfo[] = [
    { id: 'llama3.3', name: 'Llama 3.3' },
    { id: 'qwen3', name: 'Qwen 3' },
    { id: 'gemma3', name: 'Gemma 3' },
  ]
  defaultModel = process.env.OLLAMA_MODEL || 'llama3.3'
  constructor(config: ConfigService) { super(config) }

  getApiKey(): string | undefined {
    return 'ollama' // Ollama doesn't need a real key but the parent class Authorization header needs a value
  }

  async checkInstalled(): Promise<boolean> {
    try {
      const base = (process.env.OLLAMA_API_URL || 'http://localhost:11434').replace(/\/v1.*/, '')
      const res = await fetch(`${base}/api/tags`, { signal: AbortSignal.timeout(3000) })
      return res.ok
    } catch { return false }
  }

  buildApiRequest(messages: Message[], systemPrompt: string, model: string): ApiRequest {
    const body = {
      model, stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        ...this.formatMessages(messages),
      ],
    }
    return {
      url: this.apiUrl,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  }
}
