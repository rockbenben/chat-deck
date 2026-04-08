import { memo, useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import type { CompareProviderResult } from '@chat-deck/shared'
import { ScrollArea } from '../ui/scroll-area'
import { cleanContent } from '../../lib/format'
import { BounceDots } from './BounceDots'
import { useI18n } from '../../i18n'

/** Live elapsed time + speed badge */
function TimeBadge({ result }: { result: CompareProviderResult }) {
  const [now, setNow] = useState(Date.now())
  const [doneAt, setDoneAt] = useState<number | null>(null)

  useEffect(() => {
    if (result.done) {
      setDoneAt(prev => prev ?? Date.now()) // Freeze time when done
      return
    }
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [result.done])

  const endTime = doneAt ?? now
  const elapsed = (endTime - result.startedAt) / 1000
  const secs = Math.round(elapsed)
  const tokSec = elapsed > 0.1 && result.chunkCount > 0
    ? Math.round(result.chunkCount / elapsed)
    : 0

  return (
    <span className="text-[10px] font-mono text-muted-foreground ml-auto flex items-center gap-1.5">
      <span>{secs}s</span>
      {tokSec > 0 && <span>~{tokSec} tok/s</span>}
    </span>
  )
}

const ProviderColumn = memo(function ProviderColumn({
  result,
  onPickWinner,
  allDone,
}: {
  result: CompareProviderResult
  onPickWinner: (provider: string, content: string) => void
  allDone: boolean
}) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col h-full border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase">{result.provider}</span>
        {result.mode && result.done && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-200 text-slate-500">
            {result.mode}
          </span>
        )}
        <TimeBadge result={result} />
      </div>

      <ScrollArea className="flex-1 p-3">
        {result.error ? (
          <div className="text-sm text-red-500 dark:text-red-400">Error: {result.error}</div>
        ) : result.content ? (
          <div className="prose prose-sm max-w-none text-sm">
            <ReactMarkdown>{cleanContent(result.content)}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-slate-400 text-sm">
            <BounceDots />
          </div>
        )}
        {!result.done && result.content && (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-slate-400 animate-pulse" />
        )}
      </ScrollArea>

      {allDone && !result.error && (
        <div className="p-2 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={() => onPickWinner(result.provider, result.content)}
            className="w-full py-1.5 text-xs font-medium rounded bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            {t.chat.pickResponse}
          </button>
        </div>
      )}
    </div>
  )
})

export function CompareView({
  results,
  providerOrder,
  onPickWinner,
}: {
  results: Record<string, CompareProviderResult>
  providerOrder: string[]
  onPickWinner: (provider: string, content: string) => void
}) {
  const { t } = useI18n()
  // Use providerOrder for stable column ordering, fall back to insertion order
  const entries = providerOrder.length > 0
    ? providerOrder.map(p => results[p]).filter(Boolean)
    : Object.values(results)
  const allDone = entries.length > 0 && entries.every(r => r.done)

  if (entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
        {t.chat.compareEmpty}
      </div>
    )
  }

  const cols = entries.length <= 2 ? 'grid-cols-2' : entries.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'

  return (
    <div className={`flex-1 grid ${cols} gap-3 p-4 overflow-hidden`}>
      {entries.map((result) => (
        <ProviderColumn
          key={result.provider}
          result={result}
          allDone={allDone}
          onPickWinner={onPickWinner}
        />
      ))}
    </div>
  )
}
