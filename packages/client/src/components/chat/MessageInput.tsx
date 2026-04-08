import { useState, useRef, useEffect, memo } from 'react'
import type { ProviderInfo } from '@chat-deck/shared'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Send, Square, GitCompare, ChevronDown } from 'lucide-react'
import { useI18n } from '../../i18n'

interface Props {
  onSend: (content: string) => void
  onAbort: () => void
  isStreaming: boolean
  compareMode?: boolean
  providers?: ProviderInfo[]
  activeProvider?: string | null
  onProviderChange?: (provider: string) => void
}

export const MessageInput = memo(function MessageInput({ onSend, onAbort, isStreaming, compareMode, providers, activeProvider, onProviderChange }: Props) {
  const { t } = useI18n()
  const [content, setContent] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

  // Compute display name for current selection
  const currentDisplayName = (() => {
    if (!activeProvider || !providers) return t.chat.defaultProvider
    const p = providers.find(pr => pr.name === activeProvider)
    return p?.displayName || activeProvider
  })()

  const adjustHeight = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  useEffect(() => {
    if (!isStreaming) textareaRef.current?.focus()
  }, [isStreaming])

  useEffect(() => {
    adjustHeight()
  }, [content])

  const handleSubmit = () => {
    const trimmed = content.trim()
    if (!trimmed || isStreaming) return
    onSend(trimmed)
    setContent('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t p-4">
      <div className="max-w-3xl mx-auto flex gap-2 items-end">
        {providers && providers.filter(p => p.installed && p.enabled).length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="h-8 px-2 text-xs rounded-lg border border-input bg-background hover:bg-accent flex items-center gap-1 whitespace-nowrap"
              title={t.chat.switchProvider}
            >
              <span className="font-medium">{currentDisplayName}</span>
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
            {dropdownOpen && (
              <div className="absolute bottom-full mb-1 left-0 bg-popover border rounded-lg shadow-lg py-1 min-w-[200px] z-50 max-h-[300px] overflow-y-auto">
                <button
                  onClick={() => { onProviderChange?.(''); setDropdownOpen(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${!activeProvider ? 'bg-accent font-medium' : ''}`}
                >
                  {t.chat.defaultProfile}
                </button>
                {providers.filter(p => p.installed && p.enabled).map(p => (
                  <button
                    key={p.name}
                    onClick={() => { onProviderChange?.(p.name); setDropdownOpen(false) }}
                    className={`w-full text-left px-3 py-1.5 text-sm hover:bg-accent ${
                      activeProvider === p.name ? 'bg-accent font-medium' : ''
                    }`}
                  >
                    {p.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={compareMode ? t.chat.comparePlaceholder : t.chat.inputPlaceholder}
          rows={1}
          className="min-h-[40px] max-h-[200px] resize-none"
        />
        {isStreaming ? (
          <Button variant="destructive" size="icon" onClick={onAbort} className="shrink-0" aria-label={t.chat.stopResponse}>
            <Square className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!content.trim()}
            aria-label={compareMode ? t.chat.compareAriaLabel : t.chat.sendAriaLabel}
            className={`shrink-0 ${compareMode ? 'bg-blue-500 hover:bg-blue-600' : ''}`}
          >
            {compareMode ? <GitCompare className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          </Button>
        )}
      </div>
    </div>
  )
})
