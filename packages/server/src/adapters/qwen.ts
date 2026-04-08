import { OpenAICompatAdapter } from './openai-compat.js'
import type { ModelInfo } from './types.js'
import type { ConfigService } from '../services/config.js'

export class QwenAdapter extends OpenAICompatAdapter {
  name = 'qwen'
  displayName = 'Qwen'
  command = 'qwen'
  apiKeyName = 'qwen'
  apiUrl = process.env.QWEN_API_URL || 'https://chat.qwen.ai/api/v1/chat/completions'
  models: ModelInfo[] = [
    { id: 'qwen-max-latest', name: 'Qwen Max' },
    { id: 'qwen-plus-latest', name: 'Qwen Plus' },
    { id: 'qwen-turbo-latest', name: 'Qwen Turbo' },
  ]
  defaultModel = process.env.QWEN_MODEL || 'qwen-max-latest'

  constructor(config: ConfigService) { super(config) }
  protected envKeyName(): string { return 'QWEN_API_KEY' }

  getApiKey(): string | undefined {
    return process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || this.config.getApiKey('qwen')
  }
}
