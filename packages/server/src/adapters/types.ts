import type { Message } from '@chat-deck/shared'

export interface SendMessageOptions {
  systemPrompt: string
  messages: Message[]
  model?: string
  sessionMeta?: Record<string, unknown>
  onChunk: (text: string) => void
  onDone: (meta?: Record<string, unknown>) => void | Promise<void>
  onError: (error: Error) => void
}

export interface AdapterError {
  code: 'NO_API_KEY' | 'CLI_NOT_FOUND' | 'RATE_LIMIT' | 'AUTH_FAILED' | 'TIMEOUT' | 'UNKNOWN'
  message: string
  provider: string
  suggestion: string
}

export interface ModelInfo {
  id: string
  name: string
}

export interface CLIAdapter {
  name: string
  displayName: string
  command: string
  models: ModelInfo[]
  defaultModel: string
  checkInstalled(): Promise<boolean>
  sendMessage(opts: SendMessageOptions): { abort: () => void }
}
