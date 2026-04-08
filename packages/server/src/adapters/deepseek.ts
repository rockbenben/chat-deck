import { OpenAICompatAdapter } from './openai-compat.js'
import type { ModelInfo } from './types.js'
import type { ConfigService } from '../services/config.js'

export class DeepSeekAdapter extends OpenAICompatAdapter {
  name = 'deepseek'
  displayName = 'DeepSeek'
  command = ''
  apiKeyName = 'deepseek'
  apiUrl = 'https://api.deepseek.com/chat/completions'
  models: ModelInfo[] = [
    { id: 'deepseek-chat', name: 'DeepSeek V3' },
    { id: 'deepseek-reasoner', name: 'DeepSeek R1' },
  ]
  defaultModel = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
  constructor(config: ConfigService) { super(config) }
  protected envKeyName(): string { return 'DEEPSEEK_API_KEY' }
}
