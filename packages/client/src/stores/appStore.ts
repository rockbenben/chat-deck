import { create } from 'zustand'
import type { Profile, Session, ProviderInfo, Message, CompareProviderResult, Template, CreateTemplateInput } from '@chat-deck/shared'
import { api } from '../lib/api'

interface AppState {
  // Data
  profiles: Profile[]
  sessions: Session[]
  providers: ProviderInfo[]
  selectedProfileId: string | null
  selectedSessionId: string | null
  streamingContent: Record<string, string>
  currentSession: Session | null
  lastDoneMode: string | null

  // Templates
  templates: Template[]

  // Compare mode
  compareMode: boolean
  compareResults: Record<string, CompareProviderResult>
  compareProviderOrder: string[]

  // Pagination
  hasMoreMessages: boolean

  // UI state
  loading: boolean
  sidebarOpen: boolean
  profileEditorOpen: boolean
  editingProfile: Profile | null

  // Actions
  loadProfiles: () => Promise<void>
  loadSessions: (profileId: string) => Promise<void>
  loadProviders: () => Promise<void>
  selectProfile: (id: string) => Promise<void>
  selectSession: (id: string | null) => void
  createProfile: (input: Parameters<typeof api.profiles.create>[0]) => Promise<Profile>
  updateProfile: (id: string, input: Parameters<typeof api.profiles.update>[1]) => Promise<Profile>
  deleteProfile: (id: string) => Promise<void>
  createSession: (profileId: string, title: string) => Promise<Session>
  archiveSession: (id: string) => Promise<void>
  appendStreamChunk: (sessionId: string, chunk: string) => void
  finalizeStream: (sessionId: string) => void
  reloadCurrentSession: () => Promise<void>
  loadCurrentSession: () => Promise<void>
  addOptimisticMessage: (content: string) => void
  forkAndEdit: (sessionId: string, msgId: string, newContent: string) => Promise<void>
  regenerate: (sessionId: string, msgId: string) => Promise<Session | undefined>
  setLastDoneMode: (mode: string | null) => void
  setCompareMode: (on: boolean) => void
  initCompare: (providers: string[]) => void
  appendCompareChunk: (provider: string, content: string) => void
  markCompareDone: (provider: string, mode?: string) => void
  markCompareError: (provider: string, error: string) => void
  resetCompare: () => void
  loadMoreMessages: () => Promise<void>
  loadTemplates: () => Promise<void>
  createTemplate: (input: CreateTemplateInput) => Promise<Template>
  deleteTemplate: (id: string) => Promise<void>
  createSessionFromTemplate: (template: Template) => Promise<void>
  exportSession: (sessionId: string) => Promise<void>
  setSidebarOpen: (open: boolean) => void
  openProfileEditor: (profile: Profile | null) => void
  closeProfileEditor: () => void
}

// Batch rapid streaming chunks into single state updates per animation frame
const chunkBuffer = new Map<string, string>()
const compareChunkBuffer = new Map<string, string>()
let flushScheduled = false

function scheduleFlush(set: (fn: (state: AppState) => Partial<AppState>) => void) {
  if (flushScheduled) return
  flushScheduled = true
  requestAnimationFrame(() => {
    flushScheduled = false
    const hasDirect = chunkBuffer.size > 0
    const hasCompare = compareChunkBuffer.size > 0
    if (!hasDirect && !hasCompare) return

    const directBatch = hasDirect ? new Map(chunkBuffer) : null
    const compareBatch = hasCompare ? new Map(compareChunkBuffer) : null
    chunkBuffer.clear()
    compareChunkBuffer.clear()

    set((state) => {
      const updates: Partial<AppState> = {}

      if (directBatch) {
        const sc = { ...state.streamingContent }
        for (const [sid, chunk] of directBatch) {
          sc[sid] = (sc[sid] || '') + chunk
        }
        updates.streamingContent = sc
      }

      if (compareBatch) {
        const cr = { ...state.compareResults }
        for (const [provider, chunk] of compareBatch) {
          const prev = cr[provider]
          if (prev) {
            cr[provider] = { ...prev, content: prev.content + chunk, chunkCount: prev.chunkCount + 1 }
          }
        }
        updates.compareResults = cr
      }

      return updates
    })
  })
}

export const useAppStore = create<AppState>((set, get) => ({
  profiles: [],
  sessions: [],
  providers: [],
  selectedProfileId: null,
  selectedSessionId: null,
  streamingContent: {},
  currentSession: null,
  lastDoneMode: null,
  templates: [],
  compareMode: false,
  compareResults: {},
  compareProviderOrder: [],
  hasMoreMessages: true,
  loading: true,
  sidebarOpen: true,
  profileEditorOpen: false,
  editingProfile: null,

  loadProfiles: async () => {
    const profiles = await api.profiles.list()
    set({ profiles, loading: false })
  },

  loadSessions: async (profileId: string) => {
    try {
      const sessions = await api.sessions.list(profileId)
      // Guard: profile may have changed during fetch
      if (get().selectedProfileId !== profileId) return
      const sorted = sessions
        .filter(s => !s.archived)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      set({ sessions: sorted })
    } catch {
      // keep current sessions on failure
    }
  },

  loadProviders: async () => {
    try {
      const providers = await api.providers.list()
      set({ providers })
    } catch {
      // WS __connected handler in AppShell retries when server becomes available
    }
  },

  selectProfile: async (id: string) => {
    set({ selectedProfileId: id, selectedSessionId: null, sessions: [], currentSession: null })
    await get().loadSessions(id)
    // Guard: user may have switched profiles during load
    if (get().selectedProfileId !== id) return
    const { sessions } = get()
    if (sessions.length > 0) {
      set({ selectedSessionId: sessions[0].id })
      await get().loadCurrentSession()
    } else {
      try {
        await get().createSession(id, 'New Chat')
        // Guard again: if profile changed during create, don't select the ghost session
        if (get().selectedProfileId !== id) return
      } catch {
        // Session creation failed — user can manually create
      }
    }
  },

  selectSession: (id: string | null) => {
    set({ selectedSessionId: id, currentSession: null, lastDoneMode: null })
    // loadCurrentSession is triggered by ChatPanel's selectedSessionId effect
  },

  createProfile: async (input) => {
    const profile = await api.profiles.create(input)
    set((state) => ({ profiles: [...state.profiles, profile] }))
    // Auto-select the new profile and create its first session
    await get().selectProfile(profile.id)
    return profile
  },

  updateProfile: async (id, input) => {
    const updated = await api.profiles.update(id, input)
    set((state) => ({
      profiles: state.profiles.map(p => p.id === id ? updated : p),
    }))
    return updated
  },

  deleteProfile: async (id) => {
    try {
      await api.profiles.delete(id)
    } catch (e) {
      console.error('Failed to delete profile:', e)
      return
    }
    // Update locally instead of full reload
    set((state) => {
      const profiles = state.profiles.filter(p => p.id !== id)
      const isSelected = state.selectedProfileId === id
      return {
        profiles,
        ...(isSelected ? { selectedProfileId: null, selectedSessionId: null, sessions: [], currentSession: null } : {}),
      }
    })
  },

  createSession: async (profileId, title) => {
    const session = await api.sessions.create({ profileId, title })
    // Insert locally at the top instead of full server reload
    set((state) => ({
      sessions: [session, ...state.sessions],
      selectedSessionId: session.id,
      currentSession: session,
    }))
    return session
  },

  archiveSession: async (id) => {
    try {
      await api.sessions.archive(id)
    } catch (e) {
      console.error('Failed to archive session:', e)
      return
    }
    // Remove from local list immediately
    set((state) => {
      const sessions = state.sessions.filter(s => s.id !== id)
      const isSelected = state.selectedSessionId === id
      return {
        sessions,
        ...(isSelected ? { selectedSessionId: sessions[0]?.id ?? null, currentSession: null } : {}),
      }
    })
  },

  appendStreamChunk: (sessionId, chunk) => {
    chunkBuffer.set(sessionId, (chunkBuffer.get(sessionId) || '') + chunk)
    scheduleFlush(set)
  },

  finalizeStream: (sessionId) => {
    chunkBuffer.delete(sessionId) // Clear any pending buffered chunks
    // Use set() synchronously so that any pending rAF flush won't resurrect this session's streaming
    set((state) => {
      const { [sessionId]: _, ...rest } = state.streamingContent
      return { streamingContent: rest }
    })
  },

  reloadCurrentSession: async () => {
    const { selectedSessionId, selectedProfileId } = get()
    if (!selectedSessionId) return
    // Parallel + resilient: one failing doesn't kill the other
    await Promise.allSettled([
      selectedProfileId ? get().loadSessions(selectedProfileId) : Promise.resolve(),
      get().loadCurrentSession(),
    ])
  },

  loadCurrentSession: async () => {
    const { selectedSessionId } = get()
    if (!selectedSessionId) {
      set({ currentSession: null })
      return
    }
    try {
      const session = await api.sessions.get(selectedSessionId)
      // Guard: user may have switched sessions while this request was in flight
      if (get().selectedSessionId === selectedSessionId) {
        set({ currentSession: session, hasMoreMessages: true })
      }
    } catch {
      // Keep existing currentSession — avoids UI disappearing
    }
  },

  addOptimisticMessage: (content: string) => {
    set((state) => {
      if (!state.currentSession) return state
      const optimisticMsg: Message = {
        id: 'tmp-' + crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      }
      return {
        currentSession: {
          ...state.currentSession,
          messages: [...state.currentSession.messages, optimisticMsg],
        },
      }
    })
  },

  forkAndEdit: async (sessionId, msgId, newContent) => {
    try {
      const forked = await api.sessions.fork(sessionId, { forkPoint: msgId, newContent })
      // Insert forked session locally instead of full reload
      set((state) => ({
        sessions: [forked, ...state.sessions],
        selectedSessionId: forked.id,
        currentSession: forked,
      }))
    } catch {
      // Fork failed — stay on current session
    }
  },

  regenerate: async (sessionId, msgId) => {
    const updated = await api.sessions.deleteMessagesAfter(sessionId, msgId)
    if (!updated) throw new Error('Session or message not found')
    set({ currentSession: updated })
    return updated
  },

  setLastDoneMode: (mode) => set({ lastDoneMode: mode }),

  setCompareMode: (on) => set({ compareMode: on, compareResults: {}, compareProviderOrder: [] }),

  initCompare: (providers) => {
    const now = Date.now()
    const results: Record<string, CompareProviderResult> = {}
    for (const p of providers) {
      results[p] = { provider: p, content: '', done: false, startedAt: now, chunkCount: 0 }
    }
    set({ compareResults: results, compareProviderOrder: providers })
  },

  appendCompareChunk: (provider, content) => {
    compareChunkBuffer.set(provider, (compareChunkBuffer.get(provider) || '') + content)
    scheduleFlush(set)
  },

  markCompareDone: (provider, mode) => {
    set((state) => {
      const prev = state.compareResults[provider]
      if (!prev) return state
      return {
        compareResults: {
          ...state.compareResults,
          [provider]: { ...prev, done: true, mode },
        },
      }
    })
  },

  markCompareError: (provider, error) => {
    set((state) => {
      const prev = state.compareResults[provider]
      if (!prev) return state
      return {
        compareResults: {
          ...state.compareResults,
          [provider]: { ...prev, done: true, error },
        },
      }
    })
  },

  resetCompare: () => set({ compareResults: {}, compareProviderOrder: [] }),

  loadMoreMessages: async () => {
    const { selectedSessionId, currentSession } = get()
    if (!selectedSessionId || !currentSession) return
    // Load without limit to get the full message history
    try {
      const full = await api.sessions.get(selectedSessionId)
      if (get().selectedSessionId !== selectedSessionId) return
      if (full) {
        // If we got no more messages than we already have, there are no more
        const hasMore = full.messages.length > currentSession.messages.length
        set({ currentSession: full, hasMoreMessages: hasMore })
      }
    } catch {
      // Keep existing state on failure
    }
  },

  loadTemplates: async () => {
    try {
      const templates = await api.templates.list()
      set({ templates })
    } catch {
      // keep current templates on failure
    }
  },

  createTemplate: async (input) => {
    const template = await api.templates.create(input)
    set((state) => ({ templates: [...state.templates, template] }))
    return template
  },

  deleteTemplate: async (id) => {
    try {
      await api.templates.delete(id)
      set((state) => ({ templates: state.templates.filter(t => t.id !== id) }))
    } catch {
      // keep current state
    }
  },

  createSessionFromTemplate: async (template) => {
    const { selectedProfileId } = get()
    if (!selectedProfileId) return
    try {
      // createSession already inserts locally and selects — no need for loadSessions
      const session = await get().createSession(selectedProfileId, template.name)
      // If template has a firstMessage, auto-send it via WebSocket
      if (template.firstMessage?.trim()) {
        get().addOptimisticMessage(template.firstMessage)
        // Dynamically import to avoid circular dependency
        const { chatWs } = await import('../lib/ws')
        chatWs.send({ type: 'send', sessionId: session.id, content: template.firstMessage })
      }
    } catch {
      // Creation failed
    }
  },

  exportSession: async (sessionId) => {
    try {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/export?format=markdown`, {
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') || ''
      // Handle both filename="x" and filename*=UTF-8''x formats
      const utf8Match = disposition.match(/filename\*=UTF-8''(.+)/i)
      const plainMatch = disposition.match(/filename="(.+)"/)
      const filename = utf8Match?.[1] ? decodeURIComponent(utf8Match[1]) : plainMatch?.[1] || 'conversation.md'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // Export failed silently
    }
  },

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  openProfileEditor: (profile) => set({ profileEditorOpen: true, editingProfile: profile }),
  closeProfileEditor: () => set({ profileEditorOpen: false, editingProfile: null }),
}))
