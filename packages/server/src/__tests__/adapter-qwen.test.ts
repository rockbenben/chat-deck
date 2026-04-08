import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QwenAdapter } from '../adapters/qwen.js'
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

describe('QwenAdapter', () => {
  let adapter: QwenAdapter
  beforeEach(() => {
    adapter = new QwenAdapter(mockConfig)
    vi.clearAllMocks()
  })

  it('has correct name and command', () => {
    expect(adapter.name).toBe('qwen')
    expect(adapter.command).toBe('qwen')
  })

  it('checkInstalled returns true when CLI exists', async () => {
    mockedExeca.mockReturnValue({ stdout: 'qwen 1.0' } as any)
    expect(await adapter.checkInstalled()).toBe(true)
    expect(mockedExeca).toHaveBeenCalledWith('qwen', ['--version'])
  })

  it('sendMessage spawns qwen with chat --system and the full prompt', () => {
    const fakeProc = makeFakeProcess()
    mockedExeca.mockReturnValue(fakeProc as any)

    const messages: Message[] = [
      { id: '1', role: 'user', content: 'What is AI?', timestamp: '2024-01-01T00:00:00Z' },
    ]
    const onChunk = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()

    adapter.sendMessage({
      systemPrompt: 'You are an AI assistant',
      messages,
      onChunk,
      onDone,
      onError,
    })

    const callArgs = mockedExeca.mock.calls[0] as unknown as [string, string[]]
    expect(callArgs[0]).toBe('qwen')
    expect(callArgs[1][0]).toBe('chat')
    expect(callArgs[1][1]).toBe('--system')
    expect(callArgs[1][2]).toBe('You are an AI assistant')
    expect(typeof callArgs[1][3]).toBe('string')
    expect(callArgs[1][3]).toContain('[User] What is AI?')

    fakeProc.emitStdout('AI stands for...')
    expect(onChunk).toHaveBeenCalledWith('AI stands for...')

    fakeProc.emit('close', 0)
    expect(onDone).toHaveBeenCalled()
  })
})
