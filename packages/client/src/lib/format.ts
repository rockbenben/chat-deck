/** Remove excessive blank lines (3+ consecutive newlines → 2) */
const EXCESSIVE_NEWLINES = /\n{3,}/g

export function cleanContent(text: string): string {
  return text.replace(EXCESSIVE_NEWLINES, '\n\n').trim()
}
