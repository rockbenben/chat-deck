import type { Message } from '@chat-deck/shared'

// Most OS have ~128KB-2MB arg limit; keep prompt well under
const MAX_PROMPT_LENGTH = 100_000

/**
 * Build a natural-language prompt with system instruction and conversation history.
 * Used by adapters that don't have native system prompt / multi-turn support.
 * Truncates older messages if the combined prompt would exceed the arg limit.
 */
export function buildConversationPrompt(systemPrompt: string, messages: Message[]): string {
  if (messages.length === 0) {
    return `You must follow this instruction: ${systemPrompt}`
  }

  const parts: string[] = []

  parts.push(`You must follow this instruction: ${systemPrompt}`)

  const lastMessage = messages[messages.length - 1]
  const lastLine = `User: ${lastMessage.content}`

  if (messages.length > 1) {
    parts.push('')
    parts.push('Previous conversation:')
    const history = messages.slice(0, -1)
    let historyLen = 0
    const budget = MAX_PROMPT_LENGTH - parts.join('\n').length - lastLine.length - 10
    // Include most recent messages first, truncate oldest if over budget
    const included: string[] = []
    for (let i = history.length - 1; i >= 0; i--) {
      const line = `${history[i].role === 'user' ? 'User' : 'Assistant'}: ${history[i].content}`
      if (historyLen + line.length > budget) break
      included.unshift(line)
      historyLen += line.length
    }
    parts.push(...included)
    parts.push('')
  }

  parts.push(lastLine)

  return parts.join('\n')
}
