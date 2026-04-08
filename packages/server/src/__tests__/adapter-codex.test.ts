import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CodexAdapter } from '../adapters/codex.js'
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

describe('CodexAdapter', () => {
  let adapter: CodexAdapter
  beforeEach(() => {
    adapter = new CodexAdapter(mockConfig)
    vi.clearAllMocks()
  })

  it('has correct name and command', () => {
    expect(adapter.name).toBe('codex')
    expect(adapter.command).toBe('codex')
  })

  it('checkInstalled returns true when CLI exists', async () => {
    mockedExeca.mockReturnValue({ stdout: 'codex 1.0' } as any)
    expect(await adapter.checkInstalled()).toBe(true)
    expect(mockedExeca).toHaveBeenCalledWith('codex', ['--version'])
  })

  it('checkInstalled returns false when CLI missing', async () => {
    mockedExeca.mockRejectedValue(new Error('not found'))
    expect(await adapter.checkInstalled()).toBe(false)
  })

  it('sendMessage spawns codex with --full-auto and the full prompt', () => {
    const fakeProc = makeFakeProcess()
    mockedExeca.mockReturnValue(fakeProc as any)

    const messages: Message[] = [
      { id: '1', role: 'user', content: 'Write a function', timestamp: '2024-01-01T00:00:00Z' },
    ]
    const onChunk = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()

    adapter.sendMessage({
      systemPrompt: 'You are a coder',
      messages,
      onChunk,
      onDone,
      onError,
    })

    const callArgs = mockedExeca.mock.calls[0] as unknown as [string, string[]]
    expect(callArgs[0]).toBe('codex')
    expect(callArgs[1][0]).toBe('--full-auto')
    expect(typeof callArgs[1][1]).toBe('string')
    expect(callArgs[1][1]).toContain('[System] You are a coder')
    expect(callArgs[1][1]).toContain('[User] Write a function')

    fakeProc.emitStdout('some output')
    expect(onChunk).toHaveBeenCalledWith('some output')

    fakeProc.emit('close', 0)
    expect(onDone).toHaveBeenCalled()
  })
})
