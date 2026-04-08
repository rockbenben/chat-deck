/**
 * Parse Server-Sent Events stream per the SSE specification.
 * Handles multi-line data fields and dispatches on empty-line boundaries.
 */
export async function parseSSEStream(
  response: Response,
  onEvent: (event: string, data: string) => void,
): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = 'message'
  let dataLines: string[] = []

  const dispatch = () => {
    if (dataLines.length > 0) {
      const data = dataLines.join('\n')
      if (data !== '[DONE]') {
        onEvent(currentEvent, data)
      }
    }
    // Reset per SSE spec after dispatch
    currentEvent = 'message'
    dataLines = []
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        buffer += decoder.decode()
      } else {
        buffer += decoder.decode(value, { stream: true })
      }

      const lines = buffer.split('\n')
      buffer = done ? '' : (lines.pop() || '')

      for (let line of lines) {
        // Strip trailing \r from \r\n line endings per SSE spec
        if (line.endsWith('\r')) line = line.slice(0, -1)

        if (line === '') {
          // Empty line = end of event block → dispatch
          dispatch()
        } else if (line.startsWith(':')) {
          // SSE comment — ignore
        } else if (line.startsWith('event:')) {
          // Per SSE spec: strip exactly one leading space after the colon
          const value = line.slice(6)
          currentEvent = value.startsWith(' ') ? value.slice(1) : value
        } else if (line.startsWith('data:')) {
          // Per SSE spec: strip exactly one leading space after the colon
          const value = line.slice(5)
          dataLines.push(value.startsWith(' ') ? value.slice(1) : value)
        }
        // Ignore other fields (id, retry) — not needed for LLM streaming
      }

      if (done) {
        // Dispatch any remaining buffered event
        dispatch()
        break
      }
    }
  } finally {
    reader.releaseLock()
  }
}
