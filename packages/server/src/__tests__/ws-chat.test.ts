import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChatHandler } from '../ws/chat.js'
import type { SessionService } from '../services/session.js'
import type { ProfileService } from '../services/profile.js'
import type { AdapterRegistry } from '../adapters/registry.js'
import type { CLIAdapter } from '../adapters/types.js'

function createMockWs() {
  return { send: vi.fn(), readyState: 1, OPEN: 1 }
}

describe('ChatHandler', () => {
  let handler: ChatHandler
  let mockSessionService: SessionService
  let mockProfileService: ProfileService
  let mockRegistry: AdapterRegistry
  let mockAdapter: CLIAdapter

  beforeEach(() => {
    mockAdapter = {
      name: 'claude-code', displayName: 'Claude Code', command: 'claude',
      models: [], defaultModel: 'claude',
      checkInstalled: vi.fn().mockResolvedValue(true),
      sendMessage: vi.fn().mockReturnValue({ abort: vi.fn() }),
    }
    mockProfileService = {
      getById: vi.fn().mockResolvedValue({ id: 'p1', name: 'Test', systemPrompt: 'Be helpful.', cliProvider: 'claude-code' }),
    } as any
    mockSessionService = {
      getById: vi.fn().mockResolvedValue({ id: 's1', profileId: 'p1', messages: [], adapterMeta: {} }),
      addMessage: vi.fn().mockImplementation(async (sessionId, msg) => ({
        id: 's1', profileId: 'p1', messages: [{ id: 'm1', ...msg, timestamp: new Date().toISOString() }],
      })),
      updateMeta: vi.fn(),
      update: vi.fn(),
    } as any
    mockRegistry = { get: vi.fn().mockReturnValue(mockAdapter) } as any
    handler = new ChatHandler(mockSessionService, mockProfileService, mockRegistry)
  })

  it('handles send message and invokes adapter', async () => {
    const ws = createMockWs()
    await handler.handleMessage(ws as any, { type: 'send', sessionId: 's1', content: 'Hello' })
    expect(mockSessionService.addMessage).toHaveBeenCalledWith('s1', { role: 'user', content: 'Hello' })
    expect(mockAdapter.sendMessage).toHaveBeenCalled()
  })

  it('sends error when session not found', async () => {
    const ws = createMockWs()
    ;(mockSessionService.getById as any).mockResolvedValue(null)
    await handler.handleMessage(ws as any, { type: 'send', sessionId: 'nonexistent', content: 'Hello' })
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"error"'))
  })

  it('sends error when profile not found', async () => {
    const ws = createMockWs()
    ;(mockProfileService.getById as any).mockResolvedValue(null)
    await handler.handleMessage(ws as any, { type: 'send', sessionId: 's1', content: 'Hello' })
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"error"'))
  })

  it('sends error when adapter not found', async () => {
    const ws = createMockWs()
    ;(mockRegistry.get as any).mockReturnValue(undefined)
    await handler.handleMessage(ws as any, { type: 'send', sessionId: 's1', content: 'Hello' })
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"error"'))
  })
})
