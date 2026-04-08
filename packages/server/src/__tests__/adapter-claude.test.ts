import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ClaudeCodeAdapter } from '../adapters/claude-code.js'
import type { Message } from '@chat-deck/shared'
import type { ConfigService } from '../services/config.js'

const mockConfig = { getApiKey: () => undefined, isProviderEnabled: () => true } as unknown as ConfigService

vi.mock('execa', () => ({ execa: vi.fn() }))
import { execa } from 'execa'
const mockedExeca = vi.mocked(execa)

function makeFakeProcess() {
  const listeners: Record<string, ((...args: unknown[]) => void)[]> = {}
  const fakeProc = {
    stdout: {
      on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
        listeners[`stdout:${event}`] = listeners[`stdout:${event}`] || []
        listeners[`stdout:${event}`].push(cb)
      }),
    },
    stderr: {
      on: vi.fn(),
    },
    on: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
      listeners[event] = listeners[event] || []
      listeners[event].push(cb)
    }),
    kill: vi.fn(),
    emit(event: string, ...args: unknown[]) {
      for (const cb of listeners[event] || []) cb(...args)
    },
    emitStdout(data: string) {
      for (const cb of listeners['stdout:data'] || []) cb(Buffer.from(data))
    },
  }
  return fakeProc
}

describe('ClaudeCodeAdapter', () => {
  let adapter: ClaudeCodeAdapter
  beforeEach(() => {
    adapter = new ClaudeCodeAdapter(mockConfig)
    vi.clearAllMocks()
  })

  it('has correct name and command', () => {
    expect(adapter.name).toBe('claude-code')
    expect(adapter.command).toBe('claude')
  })

  it('checkInstalled returns true when CLI exists', async () => {
    mockedExeca.mockReturnValue({ stdout: 'claude 1.0' } as any)
    expect(await adapter.checkInstalled()).toBe(true)
    expect(mockedExeca).toHaveBeenCalledWith('claude', ['--version'])
  })

  it('checkInstalled returns false when CLI missing', async () => {
    mockedExeca.mockRejectedValue(new Error('not found'))
    expect(await adapter.checkInstalled()).toBe(false)
  })

  it('sendMessage spawns claude with correct args and streams output', () => {
    const fakeProc = makeFakeProcess()
    mockedExeca.mockReturnValue(fakeProc as any)

    const messages: Message[] = [
      { id: '1', role: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
    ]
    const onChunk = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()

    adapter.sendMessage({
      systemPrompt: 'You are helpful',
      messages,
      onChunk,
      onDone,
      onError,
    })

    expect(mockedExeca).toHaveBeenCalledWith(
      'claude',
      ['-p', '--output-format', 'stream-json', '--system-prompt', 'You are helpful', 'Hello'],
      expect.objectContaining({ reject: false }),
    )

    // Simulate streaming JSON output
    const jsonLine = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'text', text: 'Hi there' }] },
    })
    fakeProc.emitStdout(jsonLine + '\n')
    expect(onChunk).toHaveBeenCalledWith('Hi there')

    fakeProc.emit('close', 0)
    expect(onDone).toHaveBeenCalled()
    expect(onError).not.toHaveBeenCalled()
  })

  it('abort kills the subprocess', () => {
    const fakeProc = makeFakeProcess()
    mockedExeca.mockReturnValue(fakeProc as any)

    const messages: Message[] = [
      { id: '1', role: 'user', content: 'Hello', timestamp: '2024-01-01T00:00:00Z' },
    ]
    const { abort } = adapter.sendMessage({
      systemPrompt: 'sys',
      messages,
      onChunk: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
    })

    abort()
    expect(fakeProc.kill).toHaveBeenCalled()
  })
})
