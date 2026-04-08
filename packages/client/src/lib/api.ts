import type { Profile, Session, ProviderInfo, CreateProfileInput, UpdateProfileInput, CreateSessionInput, ForkSessionInput, Template, CreateTemplateInput, UpdateTemplateInput } from '@chat-deck/shared'

const BASE = '/api'

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...opts?.headers as Record<string, string> }
  if (opts?.body) headers['Content-Type'] = 'application/json'
  const signal = opts?.signal ?? AbortSignal.timeout(15000)
  const res = await fetch(`${BASE}${path}`, { ...opts, headers, signal })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  profiles: {
    list: () => request<Profile[]>('/profiles'),
    get: (id: string) => request<Profile>(`/profiles/${id}`),
    create: (input: CreateProfileInput) => request<Profile>('/profiles', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, input: UpdateProfileInput) => request<Profile>(`/profiles/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    delete: (id: string) => request<void>(`/profiles/${id}`, { method: 'DELETE' }),
  },
  sessions: {
    list: (profileId: string) => request<Session[]>(`/sessions?profileId=${encodeURIComponent(profileId)}`),
    get: (id: string, opts?: { offset?: number; limit?: number }) => {
      const params = new URLSearchParams()
      if (opts?.offset != null) params.set('offset', String(opts.offset))
      if (opts?.limit != null) params.set('limit', String(opts.limit))
      const qs = params.toString()
      return request<Session>(`/sessions/${id}${qs ? '?' + qs : ''}`)
    },
    create: (input: CreateSessionInput) => request<Session>('/sessions', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, input: { title?: string }) => request<Session>(`/sessions/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    archive: (id: string) => request<Session>(`/sessions/${id}/archive`, { method: 'POST' }),
    fork: (id: string, input: ForkSessionInput) => request<Session>(`/sessions/${id}/fork`, { method: 'POST', body: JSON.stringify(input) }),
    deleteMessagesAfter: (id: string, msgId: string) => request<Session>(`/sessions/${id}/messages-after/${msgId}`, { method: 'DELETE' }),
    delete: (id: string) => request<void>(`/sessions/${id}`, { method: 'DELETE' }),
  },
  providers: {
    list: () => request<ProviderInfo[]>('/providers'),
  },
  config: {
    get: () => request<{ apiKeys: Record<string, string>; enabledProviders: Record<string, boolean> }>('/config'),
    updateApiKeys: (keys: Record<string, string>) => request<{ apiKeys: Record<string, string>; enabledProviders: Record<string, boolean> }>('/config/api-keys', { method: 'PUT', body: JSON.stringify(keys) }),
    updateEnabledProviders: (enabled: Record<string, boolean>) => request<{ apiKeys: Record<string, string>; enabledProviders: Record<string, boolean> }>('/config/enabled-providers', { method: 'PUT', body: JSON.stringify(enabled) }),
    testProvider: (name: string) => request<{ ok: boolean; mode: string; time: number; error?: string }>(`/config/test/${name}`, { method: 'POST', signal: AbortSignal.timeout(35000) }),
  },
  templates: {
    list: () => request<Template[]>('/templates'),
    get: (id: string) => request<Template>(`/templates/${id}`),
    create: (input: CreateTemplateInput) => request<Template>('/templates', { method: 'POST', body: JSON.stringify(input) }),
    update: (id: string, input: UpdateTemplateInput) => request<Template>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
    delete: (id: string) => request<void>(`/templates/${id}`, { method: 'DELETE' }),
  },
}
