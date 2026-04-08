import { OpenAICompatAdapter } from './openai-compat.js'
import type { ModelInfo } from './types.js'
import type { ConfigService } from '../services/config.js'

export class CodexAdapter extends OpenAICompatAdapter {
  name = 'codex'
  displayName = 'OpenAI'
  command = ''
  apiKeyName = 'openai'
  apiUrl = 'https://api.openai.com/v1/chat/completions'
  models: ModelInfo[] = [
    { id: 'gpt-4.1', name: 'GPT-4.1' },
    { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    { id: 'o3-mini', name: 'o3-mini' },
  ]
  defaultModel = process.env.OPENAI_MODEL || 'gpt-4.1'

  constructor(config: ConfigService) { super(config) }
  protected envKeyName(): string { return 'OPENAI_API_KEY' }
}
