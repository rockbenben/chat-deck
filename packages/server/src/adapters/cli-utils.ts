import { execa } from 'execa'
import os from 'os'
import { TextDecoder } from 'util'
import type { SendMessageOptions } from './types.js'

/** Check if a CLI command is installed by running --version. */
export async function checkCommandInstalled(command: string): Promise<boolean> {
  try {
    await execa(command, ['--version'], { timeout: 10_000 })
    return true
  } catch {
    return false
  }
}

const DEFAULT_CLI_TIMEOUT = 120_000

/** Spawn a CLI subprocess with standard streaming stdout/stderr handling. */
export function spawnCLI(
  command: string,
  args: string[],
  opts: Pick<SendMessageOptions, 'onChunk' | 'onDone' | 'onError'>,
  options?: { timeout?: number; cwd?: string },
): { abort: () => void } {
  const env = {
    ...process.env,
    FORCE_COLOR: '0',
    // Force UTF-8 output for Python-based CLIs on Windows (e.g. qwen)
    PYTHONIOENCODING: 'utf-8',
  }

  const subprocess = execa(command, args, {
    reject: false,
    timeout: options?.timeout ?? DEFAULT_CLI_TIMEOUT,
    stdin: 'ignore',
    cwd: options?.cwd ?? os.homedir(),
    env,
  })

  const MAX_STDERR = 65536 // 64KB cap to prevent memory exhaustion from misbehaving CLIs
  let stderrOutput = ''
  let completed = false

  // Use streaming TextDecoder to correctly handle multi-byte UTF-8 characters split across chunks
  const stdoutDecoder = new TextDecoder('utf-8')
  const stderrDecoder = new TextDecoder('utf-8')

  subprocess.stdout!.on('data', (chunk: Buffer) => {
    const text = stdoutDecoder.decode(chunk, { stream: true })
    // Skip garbled chunks (GBK decoded as UTF-8 produces replacement chars)
    if (!/\ufffd/.test(text)) opts.onChunk(text)
  })
  subprocess.stderr!.on('data', (chunk: Buffer) => {
    if (stderrOutput.length < MAX_STDERR) stderrOutput += stderrDecoder.decode(chunk, { stream: true })
  })
  subprocess.on('error', (err: Error) => {
    if (completed) return
    completed = true
    opts.onError(new Error(`Failed to spawn ${command}: ${err.message}`))
  })
  subprocess.on('close', (code, signal) => {
    if (completed) return
    completed = true
    if (code === 0) {
      Promise.resolve(opts.onDone({ mode: 'cli' })).catch(() => {})
    } else if (signal) {
      opts.onError(new Error(`${command} killed by signal ${signal}`))
    } else {
      // Truncate error message to avoid leaking verbose internal details to client
      let errMsg = stderrOutput.trim().slice(0, 500) || `${command} exited with code ${code}`
      // On Windows, CLI error messages may be garbled (GBK decoded as UTF-8).
      // Detect replacement characters and provide a clean fallback.
      if (/\ufffd/.test(errMsg)) {
        errMsg = `${command} exited with code ${code}. Error message contained non-UTF-8 characters (likely GBK encoding on Windows).`
      }
      opts.onError(new Error(errMsg))
    }
  })

  return {
    abort: () => {
      if (!completed) {
        try { subprocess.kill() } catch { /* already exited */ }
      }
    },
  }
}
