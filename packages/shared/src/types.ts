export interface Profile {
  id: string
  name: string
  systemPrompt: string
  cliProvider: string
  model?: string        // default model (optional)
  icon?: string
  stateless?: boolean   // when true, each message sent without conversation history
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  profileId: string
  title: string
  messages: Message[]
  adapterMeta?: Record<string, unknown>
  parentId?: string
  forkPoint?: string
  createdAt: string
  updatedAt: string
  archived: boolean
}

export interface SessionMeta {
  id: string
  profileId: string
  title: string
  messageCount: number
  adapterMeta?: Record<string, unknown>
  parentId?: string
  forkPoint?: string
  createdAt: string
  updatedAt: string
  archived: boolean
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  provider?: string      // which adapter generated this
  model?: string         // specific model name
  durationMs?: number    // response time in ms
}

export interface ModelInfo {
  id: string
  name: string
}

export interface ProviderInfo {
  name: string
  displayName: string
  command: string
  installed: boolean
  enabled: boolean
  models: ModelInfo[]
  defaultModel: string
}

export type CreateProfileInput = Pick<Profile, 'name' | 'systemPrompt' | 'cliProvider' | 'icon' | 'stateless'>
export type UpdateProfileInput = Partial<CreateProfileInput>
export type CreateSessionInput = Pick<Session, 'profileId' | 'title'>

export interface ForkSessionInput {
  forkPoint: string
  newContent: string
}

// Templates
export interface Template {
  id: string
  name: string
  description: string
  systemPrompt: string
  firstMessage: string
  category: string
  createdAt: string
}

export type CreateTemplateInput = Omit<Template, 'id' | 'createdAt'>
export type UpdateTemplateInput = Partial<CreateTemplateInput>

// Comparison record (persisted to session metadata)
export interface ComparisonRecord {
  timestamp: string
  userMessage: string
  results: Array<{
    provider: string
    model?: string
    content: string
    durationMs: number
    selected: boolean
  }>
}

// Compare mode types
export interface CompareProviderResult {
  provider: string
  content: string
  done: boolean
  error?: string
  mode?: string
  startedAt: number
  chunkCount: number
}

export interface CompareChunkEvent {
  type: 'compare-chunk'
  sessionId: string
  provider: string
  content: string
}

export interface CompareDoneEvent {
  type: 'compare-done'
  sessionId: string
  provider: string
  mode?: string
}

export interface CompareErrorEvent {
  type: 'compare-error'
  sessionId: string
  provider: string
  error: string
}


// WebSocket message types (server → client)
export type WsServerMessage =
  | { type: 'chunk'; sessionId: string; content: string }
  | { type: 'done'; sessionId: string; mode: string }
  | { type: 'error'; sessionId: string; error: string }
  | CompareChunkEvent
  | CompareDoneEvent
  | CompareErrorEvent
  | { type: 'profiles-changed' }

// WebSocket message types (client → server)
export type WsClientMessage =
  | { type: 'send'; sessionId: string; content: string; provider?: string; model?: string; regenerate?: boolean; stateless?: boolean }
  | { type: 'abort'; sessionId: string }
  | { type: 'compare'; sessionId: string; content: string; providers: string[]; stateless?: boolean }
  | { type: 'save-winner'; sessionId: string; content: string; comparison?: ComparisonRecord }
