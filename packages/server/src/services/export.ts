import type { Session } from '@chat-deck/shared'

export function sessionToMarkdown(session: Session): string {
  const lines: string[] = []
  lines.push(`# ${session.title}`)
  lines.push('')
  lines.push(`> Exported from ChatDeck on ${new Date().toISOString().split('T')[0]}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  if (session.messages.length === 0) {
    lines.push('*No messages in this session.*')
    lines.push('')
  } else {
    for (const msg of session.messages) {
      const label = msg.role === 'user' ? '**User**' : '**Assistant**'
      lines.push(`### ${label}`)
      lines.push('')
      lines.push(msg.content)
      lines.push('')
    }
  }

  return lines.join('\n')
}
