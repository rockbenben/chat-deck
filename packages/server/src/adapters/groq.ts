import { OpenAICompatAdapter } from './openai-compat.js'
import type { ModelInfo } from './types.js'
import type { ConfigService } from '../services/config.js'

export class GroqAdapter extends OpenAICompatAdapter {
  name = 'groq'
  displayName = 'Groq'
  command = ''
  apiKeyName = 'groq'
  apiUrl = 'https://api.groq.com/openai/v1/chat/completions'
  models: ModelInfo[] = [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
  ]
  defaultModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  constructor(config: ConfigService) { super(config) }
  protected envKeyName(): string { return 'GROQ_API_KEY' }
}
