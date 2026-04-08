import { useEffect, useRef, useState, useCallback, memo } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Message } from '@chat-deck/shared'
import { ScrollArea } from '../ui/scroll-area'
import { Copy, Check, Pencil, RefreshCw } from 'lucide-react'
import { cleanContent } from '../../lib/format'
import { BounceDots } from './BounceDots'
import { useI18n } from '../../i18n'

const PAGINATION_THRESHOLD = 50

interface Props {
  messages: Message[]
  streamingContent: string | null
  isWaiting?: boolean
  onEdit?: (msgId: string, newContent: string) => void
  onRegenerate?: (msgId: string) => void
  onLoadMore?: () => void
  hasMore?: boolean
}

/** Copy button that shows a checkmark briefly after copying */
function CopyButton({ text, className }: { text: string; className?: string }) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const textRef = useRef(text)
  textRef.current = text
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [])

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(textRef.current)
      setCopied(true)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch { /* clipboard denied or unavailable */ }
  }, [])

  return (
    <button
      onClick={handleCopy}
      className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors ${className || ''}`}
      title={t.message.copy}
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-green-500" />
        : <Copy className="w-3.5 h-3.5 text-slate-400" />
      }
    </button>
  )
}

/** Code block with language label and copy button */
function CodeBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  const { t } = useI18n()
  const lang = className?.replace('language-', '') || ''
  const code = String(children).replace(/\n$/, '')

  return (
    <div className="relative group my-2 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between bg-slate-800 px-3 py-1.5 text-xs">
        <span className="text-slate-400">{lang || t.message.code}</span>
        <CopyButton text={code} className="hover:bg-slate-700" />
      </div>
      <pre className="!m-0 !rounded-none !bg-slate-900 p-3 overflow-x-auto">
        <code className="text-sm text-slate-100">{code}</code>
      </pre>
    </div>
  )
}

/** Elapsed timer for waiting state */
const MAX_WAIT_DISPLAY = 30

function WaitingIndicator() {
  const { t } = useI18n()
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsed(s => s + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex justify-start">
      <div className="rounded-2xl px-4 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-sm flex items-center gap-2">
        <BounceDots />
        {t.message.thinking}{elapsed > 0 && <span className="text-slate-400">{Math.min(elapsed, MAX_WAIT_DISPLAY)}s</span>}
      </div>
    </div>
  )
}

/** Stable click handler for inline code copy — uses data-copy attribute */
function handleInlineCodeCopy(e: React.MouseEvent<HTMLElement>) {
  e.stopPropagation()
  const el = e.currentTarget // Capture before async — currentTarget is nullified after event dispatch
  const text = el.dataset.copy || el.textContent || ''
  navigator.clipboard.writeText(text).then(() => {
    el.style.backgroundColor = '#bbf7d0'
    setTimeout(() => { el.style.backgroundColor = '' }, 300)
  }).catch(() => {})
}

/** Markdown renderer with custom code blocks */
const markdownComponents = {
  code({ className, children }: { className?: string; children?: React.ReactNode }) {
    const isBlock = className || String(children).includes('\n')
    if (isBlock) {
      return <CodeBlock className={className}>{children}</CodeBlock>
    }
    const text = String(children)
    return (
      <code
        className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 px-1.5 py-0.5 rounded text-xs font-mono cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
        title="Click to copy"
        onClick={handleInlineCodeCopy}
        data-copy={text}
      >
        {children}
      </code>
    )
  },
  blockquote({ children }: { children?: React.ReactNode }) {
    const extractText = (node: unknown): string => {
      if (typeof node === 'string') return node
      if (Array.isArray(node)) return node.map(extractText).join('')
      if (node && typeof node === 'object' && 'props' in node && (node as any).props?.children) return extractText((node as any).props.children)
      return ''
    }
    const text = extractText(children)

    return (
      <blockquote className="relative group/quote border-l-4 border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950 pl-4 pr-8 py-2 my-2 text-slate-700 dark:text-slate-300 rounded-r">
        {children}
        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover/quote:opacity-100 transition-opacity">
          <CopyButton text={text.trim()} />
        </div>
      </blockquote>
    )
  },
}

const AssistantMessage = memo(function AssistantMessage({
  msgId, content, streaming, onRegenerate, provider, model, durationMs,
}: {
  msgId?: string; content: string; streaming?: boolean; onRegenerate?: (msgId: string) => void;
  provider?: string; model?: string; durationMs?: number
}) {
  const { t } = useI18n()
  return (
    <div className={`flex justify-start ${streaming ? '' : 'group'}`}>
      <div className="rounded-2xl px-4 py-2.5 max-w-[85%] text-sm bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700">
        <div className="prose prose-sm max-w-none prose-pre:p-0 prose-pre:m-0 prose-pre:bg-transparent prose-code:before:content-[''] prose-code:after:content-['']">
          <ReactMarkdown components={markdownComponents}>
            {cleanContent(content)}
          </ReactMarkdown>
        </div>
        {streaming ? (
          <span className="inline-block w-1.5 h-4 ml-0.5 bg-slate-400 animate-pulse" />
        ) : (
          <div className="flex items-center justify-end mt-1 gap-1">
            {provider && (
              <span className="text-[10px] text-muted-foreground mr-auto">
                {provider}
                {model ? ` \u00b7 ${model.split('-').pop()}` : ''}
                {durationMs ? ` \u00b7 ${(durationMs / 1000).toFixed(1)}s` : ''}
              </span>
            )}
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {onRegenerate && msgId && (
                <button
                  onClick={() => onRegenerate(msgId)}
                  className="p-1 rounded hover:bg-slate-200 transition-colors"
                  title={t.message.regenerate}
                >
                  <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
              <CopyButton text={content} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
})

const UserMessage = memo(function UserMessage({
  msgId, content, onEdit,
}: {
  msgId: string; content: string; onEdit?: (msgId: string) => void
}) {
  const { t } = useI18n()
  return (
    <div className="flex justify-end group">
      <div className="rounded-2xl px-4 py-2.5 max-w-[80%] text-sm bg-blue-500 text-white">
        <div className="whitespace-pre-wrap">{content}</div>
        <div className="flex justify-end mt-1 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={() => onEdit(msgId)}
              className="p-1 rounded hover:bg-blue-600 transition-colors"
              title={t.message.editFork}
            >
              <Pencil className="w-3.5 h-3.5 text-blue-200" />
            </button>
          )}
          <CopyButton text={content} className="hover:bg-blue-600" />
        </div>
      </div>
    </div>
  )
})

/** Inline editor for editing a user message */
function InlineEditor({
  msgId,
  initialContent,
  onEdit,
  onDone,
}: {
  msgId: string
  initialContent: string
  onEdit?: (msgId: string, newContent: string) => void
  onDone: (id: null) => void
}) {
  const { t } = useI18n()
  const [content, setContent] = useState(initialContent)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.focus()
    el.select()
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  const handleSubmit = () => {
    const trimmed = content.trim()
    onDone(null)
    if (trimmed && trimmed !== initialContent) onEdit?.(msgId, trimmed)
  }

  const handleCancel = () => onDone(null)

  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] w-full">
        <textarea
          ref={ref}
          value={content}
          onChange={handleChange}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
            if (e.key === 'Escape') handleCancel()
          }}
          className="w-full p-3 text-sm border border-blue-300 dark:border-blue-700 rounded-xl resize-none outline-none focus:ring-2 focus:ring-blue-400 bg-white dark:bg-slate-800 dark:text-slate-100 max-h-[200px]"
          rows={1}
        />
        <div className="flex justify-end gap-2 mt-1">
          <button onClick={handleCancel} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1">
            {t.message.cancelEdit}
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim()}
            className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {t.message.forkSend}
          </button>
        </div>
      </div>
    </div>
  )
}

export function MessageList({ messages, streamingContent, isWaiting, onEdit, onRegenerate, onLoadMore, hasMore }: Props) {
  const { t } = useI18n()
  const bottomRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)

  const handleStartEdit = useCallback((msgId: string) => {
    setEditingMsgId(msgId)
  }, [])

  useEffect(() => {
    const el = bottomRef.current
    if (!el) return
    const root = el.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null
    const observer = new IntersectionObserver(
      ([entry]) => { shouldAutoScroll.current = entry.isIntersecting },
      { threshold: 0, root },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (shouldAutoScroll.current) {
      bottomRef.current?.scrollIntoView(
        streamingContent ? undefined : { behavior: 'smooth' },
      )
    }
  }, [messages, streamingContent, isWaiting])

  return (
    <ScrollArea className="flex-1 px-4 py-4">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* Load earlier messages button — shown when there are many messages */}
        {onLoadMore && hasMore && messages.length >= PAGINATION_THRESHOLD && (
          <div className="flex justify-center pt-2 pb-1">
            <button
              onClick={onLoadMore}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {t.message.loadEarlier}
            </button>
          </div>
        )}
        {messages.map((msg) => {
          if (editingMsgId === msg.id) {
            return (
              <InlineEditor
                key={msg.id}
                msgId={msg.id}
                initialContent={msg.content}
                onEdit={onEdit}
                onDone={setEditingMsgId}
              />
            )
          }
          return msg.role === 'assistant'
            ? <AssistantMessage
                key={msg.id}
                msgId={msg.id}
                content={msg.content}
                onRegenerate={onRegenerate}
                provider={msg.provider}
                model={msg.model}
                durationMs={msg.durationMs}
              />
            : <UserMessage
                key={msg.id}
                msgId={msg.id}
                content={msg.content}
                onEdit={onEdit ? handleStartEdit : undefined}
              />
        })}

        <div aria-live="polite" aria-atomic="false">
        {isWaiting && !streamingContent && <WaitingIndicator />}

        {streamingContent && (
          <AssistantMessage content={streamingContent} streaming />
        )}
        </div>

        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}
