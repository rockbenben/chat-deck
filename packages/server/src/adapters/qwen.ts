import { OpenAICompatAdapter } from './openai-compat.js'
import type { ModelInfo, SendMessageOptions } from './types.js'
import type { ConfigService } from '../services/config.js'
import { spawnCLI } from './cli-utils.js'

export class QwenAdapter extends OpenAICompatAdapter {
  name = 'qwen'
  displayName = 'Qwen'
  command = 'qwen'
  apiKeyName = 'qwen'
  apiUrl = process.env.QWEN_API_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
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

  /** Use qwen CLI flags (--system-prompt, positional prompt) instead of embedding system prompt in the text. */
  protected sendViaCLI(opts: SendMessageOptions): { abort: () => void } {
    const args = ['--output-format', 'text']
    if (opts.systemPrompt) {
      args.push('--system-prompt', opts.systemPrompt)
    }
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
