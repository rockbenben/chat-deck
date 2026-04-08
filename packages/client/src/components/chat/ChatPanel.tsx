import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { useAppStore } from '../../stores/appStore'
import { chatWs } from '../../lib/ws'
import { MessageList } from './MessageList'
import { MessageInput } from './MessageInput'
import { CompareView } from './CompareView'
import { Download } from 'lucide-react'
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts'
import { useI18n } from '../../i18n'

const STREAM_TIMEOUT_MS = 90_000

export function ChatPanel() {
  const { t } = useI18n()
  const selectedSessionId = useAppStore(s => s.selectedSessionId)
  const currentStreaming = useAppStore(s => {
    const sid = s.selectedSessionId
    return sid ? s.streamingContent[sid] ?? null : null
  })
  const currentSession = useAppStore(s => s.currentSession)
  const lastDoneMode = useAppStore(s => s.lastDoneMode)
  const compareMode = useAppStore(s => s.compareMode)
  const compareResults = useAppStore(s => s.compareResults)
  const appendStreamChunk = useAppStore(s => s.appendStreamChunk)
  const finalizeStream = useAppStore(s => s.finalizeStream)
  const reloadCurrentSession = useAppStore(s => s.reloadCurrentSession)
  const loadCurrentSession = useAppStore(s => s.loadCurrentSession)
  const addOptimisticMessage = useAppStore(s => s.addOptimisticMessage)
  const setLastDoneMode = useAppStore(s => s.setLastDoneMode)
  const setCompareMode = useAppStore(s => s.setCompareMode)
  const appendCompareChunk = useAppStore(s => s.appendCompareChunk)
  const markCompareDone = useAppStore(s => s.markCompareDone)
  const markCompareError = useAppStore(s => s.markCompareError)
  const initCompare = useAppStore(s => s.initCompare)
  const resetCompare = useAppStore(s => s.resetCompare)
  const forkAndEdit = useAppStore(s => s.forkAndEdit)
  const regenerate = useAppStore(s => s.regenerate)
  const exportSession = useAppStore(s => s.exportSession)
  const compareProviderOrder = useAppStore(s => s.compareProviderOrder)
  const providers = useAppStore(s => s.providers)
  const hasMoreMessages = useAppStore(s => s.hasMoreMessages)
  const loadMoreMessages = useAppStore(s => s.loadMoreMessages)
  const activeProviderNames = useMemo(() => providers.filter(p => p.installed && p.enabled).map(p => p.name), [providers])
  const selectedProfileId = useAppStore(s => s.selectedProfileId)
  const profiles = useAppStore(s => s.profiles)
  const currentProfile = useMemo(() => profiles.find(p => p.id === selectedProfileId) ?? null, [profiles, selectedProfileId])

  const [isStreaming, setIsStreaming] = useState(false)
  const [isWaiting, setIsWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeProvider, setActiveProvider] = useState<string | null>(null)
  const [stateless, setStateless] = useState(false)

  // Sync stateless toggle with profile setting (on profile switch or profile edit)
  useEffect(() => {
    setStateless(currentProfile?.stateless ?? false)
  }, [currentProfile?.id, currentProfile?.stateless]) // eslint-disable-line react-hooks/exhaustive-deps
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevSessionRef = useRef<string | null>(null)

  const clearStreamTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const resetStreamState = useCallback(() => {
    setIsStreaming(false)
    setIsWaiting(false)
    clearStreamTimeout()
  }, [clearStreamTimeout])

  // Load session data when selection changes
  useEffect(() => {
    if (prevSessionRef.current && prevSessionRef.current !== selectedSessionId) {
      finalizeStream(prevSessionRef.current)
    }
    prevSessionRef.current = selectedSessionId

    if (!selectedSessionId) return
    setError(null)
    setLastDoneMode(null)
    resetStreamState()
    resetCompare()
    loadCurrentSession()
  }, [selectedSessionId, loadCurrentSession, setLastDoneMode, resetStreamState, finalizeStream, resetCompare])

  // Ref holding latest callbacks so WS effect only re-subscribes on sessionId change
  const wsHandlers = useRef({ appendStreamChunk, finalizeStream, reloadCurrentSession, loadCurrentSession, setLastDoneMode, resetStreamState, clearStreamTimeout, appendCompareChunk, markCompareDone, markCompareError })
  wsHandlers.current = { appendStreamChunk, finalizeStream, reloadCurrentSession, loadCurrentSession, setLastDoneMode, resetStreamState, clearStreamTimeout, appendCompareChunk, markCompareDone, markCompareError }

  // Listen for WS events — only re-subscribe when selectedSessionId changes
  useEffect(() => {
    if (!selectedSessionId) return
    const sid = selectedSessionId
    const h = wsHandlers

    const unsubChunk = chatWs.on('chunk', (data) => {
      if (data.sessionId === sid) {
        setIsWaiting(false)
        h.current.clearStreamTimeout()
        h.current.appendStreamChunk(sid, data.content)
      }
    })

    const unsubDone = chatWs.on('done', async (data) => {
      if (data.sessionId === sid) {
        h.current.finalizeStream(sid)
        h.current.resetStreamState()
        setError(null)
        h.current.setLastDoneMode(data.mode || null)
        await h.current.reloadCurrentSession()
      }
    })

    const unsubError = chatWs.on('error', async (data) => {
      if (data.sessionId === sid) {
        h.current.finalizeStream(sid)
        h.current.resetStreamState()
        setError(data.error || 'Unknown error')
        await h.current.loadCurrentSession()
      }
    })

    const unsubCompareChunk = chatWs.on('compare-chunk', (data) => {
      if (data.sessionId === sid) {
        setIsWaiting(false)
        h.current.clearStreamTimeout()
        h.current.appendCompareChunk(data.provider, data.content)
      }
    })

    const unsubCompareDone = chatWs.on('compare-done', (data) => {
      if (data.sessionId === sid) {
        h.current.markCompareDone(data.provider, data.mode)
      }
    })

    const unsubCompareError = chatWs.on('compare-error', (data) => {
      if (data.sessionId === sid) {
        h.current.markCompareError(data.provider, data.error)
      }
    })

    return () => {
      unsubChunk()
      unsubDone()
      unsubError()
      unsubCompareChunk()
      unsubCompareDone()
      unsubCompareError()
    }
  }, [selectedSessionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if all compare providers are done to reset streaming state
  const allCompareDone = useAppStore(s => {
    const vals = Object.values(s.compareResults)
    return vals.length > 0 && vals.every(r => r.done)
  })
  useEffect(() => {
    if (allCompareDone) resetStreamState()
  }, [allCompareDone, resetStreamState])

  const handleSend = useCallback((content: string) => {
    if (!selectedSessionId) return
    setError(null)
    addOptimisticMessage(content)
    setIsStreaming(true)
    setIsWaiting(true)

    clearStreamTimeout()
    timeoutRef.current = setTimeout(() => {
      resetStreamState()
      setError(t.error.timeout)
    }, STREAM_TIMEOUT_MS)

    if (compareMode) {
      initCompare(activeProviderNames)
      const sent = chatWs.send({
        type: 'compare',
        sessionId: selectedSessionId,
        content,
        providers: activeProviderNames,
        stateless: stateless || undefined,
      })
      if (!sent) {
        setError(t.error.notConnected)
        resetStreamState()
        resetCompare()
      }
    } else {
      const sent = chatWs.send({
        type: 'send',
        sessionId: selectedSessionId,
        content,
        provider: activeProvider || undefined,
        stateless: stateless || undefined,
      })
      if (!sent) {
        setError(t.error.notConnected)
        resetStreamState()
      }
    }
  }, [selectedSessionId, addOptimisticMessage, clearStreamTimeout, resetStreamState, compareMode, activeProviderNames, initCompare, activeProvider, stateless, t])

  const handleAbort = useCallback(() => {
    if (!selectedSessionId) return
    chatWs.send({ type: 'abort', sessionId: selectedSessionId })
    finalizeStream(selectedSessionId)
    resetStreamState()
    resetCompare()
  }, [selectedSessionId, finalizeStream, resetStreamState, resetCompare])

  const handlePickWinner = useCallback(async (provider: string, content: string) => {
    if (!selectedSessionId) return
    // Build the comparison record from current compareResults
    const userMsg = currentSession?.messages[currentSession.messages.length - 1]
    const comparison = {
      timestamp: new Date().toISOString(),
      userMessage: userMsg?.role === 'user' ? userMsg.content : '',
      results: Object.values(compareResults).map(r => ({
        provider: r.provider,
        content: r.content,
        durationMs: r.startedAt ? Date.now() - r.startedAt : 0,
        selected: r.provider === provider,
      })),
    }
    chatWs.send({ type: 'save-winner', sessionId: selectedSessionId, content, comparison })
    resetCompare()
    setLastDoneMode(provider)
    await reloadCurrentSession()
  }, [selectedSessionId, currentSession, compareResults, resetCompare, setLastDoneMode, reloadCurrentSession])

  const handleEdit = useCallback((msgId: string, newContent: string) => {
    if (!selectedSessionId) return
    forkAndEdit(selectedSessionId, msgId, newContent).catch(() => {
      setError('Failed to fork session')
    })
  }, [selectedSessionId, forkAndEdit])

  const handleRegenerate = useCallback(async (msgId: string) => {
    if (!selectedSessionId || !currentSession) return
    const msgs = currentSession.messages
    const idx = msgs.findIndex(m => m.id === msgId)
    if (idx < 1) return
    const prevUserMsg = msgs[idx - 1]
    if (prevUserMsg.role !== 'user') return
    try {
      // Keep messages up to and including the user message, removing the assistant response
      await regenerate(selectedSessionId, prevUserMsg.id)
      // Send with regenerate flag so server skips adding the user message (it already exists)
      setError(null)
      setIsStreaming(true)
      setIsWaiting(true)
      clearStreamTimeout()
      timeoutRef.current = setTimeout(() => {
        resetStreamState()
        setError(t.error.timeout)
      }, STREAM_TIMEOUT_MS)
      const sent = chatWs.send({
        type: 'send',
        sessionId: selectedSessionId,
        content: prevUserMsg.content,
        regenerate: true,
        provider: activeProvider || undefined,
        stateless: stateless || undefined,
      })
      if (!sent) {
        setError(t.error.notConnected)
        resetStreamState()
      }
    } catch {
      setError('Failed to regenerate response')
    }
  }, [selectedSessionId, currentSession, regenerate, clearStreamTimeout, resetStreamState, activeProvider, t])

  const createSession = useAppStore(s => s.createSession)

  useKeyboardShortcuts({
    onNewSession: () => {
      const pid = useAppStore.getState().selectedProfileId
      if (pid) createSession(pid, 'New Chat').catch(() => {})
    },
    onToggleCompare: () => setCompareMode(!compareMode),
    onExport: () => { if (selectedSessionId) exportSession(selectedSessionId) },
    onSwitchProvider: (index) => {
      const available = providers.filter(p => p.installed && p.enabled)
      const p = available[index]
      if (p) { setActiveProvider(p.name) }
    },
  })

  // Cleanup: abort streaming and clear timeout on unmount
  const isStreamingRef = useRef(false)
  isStreamingRef.current = isStreaming
  useEffect(() => {
    return () => {
      clearStreamTimeout()
      if (!isStreamingRef.current) return
      const sid = useAppStore.getState().selectedSessionId
      if (sid) {
        chatWs.send({ type: 'abort', sessionId: sid })
        useAppStore.getState().finalizeStream(sid)
      }
    }
  }, [clearStreamTimeout])

  const isComparing = Object.keys(compareResults).length > 0

  if (!selectedSessionId) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        {t.session.selectOrCreate}
      </div>
    )
  }

  if (!currentSession) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        {t.session.loadingSession}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-sm">{currentSession.title}</h2>
          <p className="text-xs text-muted-foreground">
            {currentSession.messages.length} {t.session.messages}
            {lastDoneMode && (
              <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                {t.session.via} {lastDoneMode.toUpperCase()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
        {/* Export */}
        {currentSession.messages.length > 0 && (
          <button
            onClick={() => exportSession(selectedSessionId)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            title={t.chat.exportMarkdown}
            aria-label={t.chat.exportAriaLabel}
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        )}
        {/* Stateless mode toggle */}
        <button
          onClick={() => setStateless(!stateless)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            stateless
              ? 'bg-amber-500 text-white border-amber-500'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          {stateless ? t.chat.statelessOn : t.chat.stateless}
        </button>
        {/* Compare mode toggle */}
        <button
          onClick={() => {
            if (compareMode && isComparing) {
              // Abort active compare on server before toggling off
              chatWs.send({ type: 'abort', sessionId: selectedSessionId })
              resetCompare()
              resetStreamState()
            }
            setCompareMode(!compareMode)
          }}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            compareMode
              ? 'bg-blue-500 text-white border-blue-500'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          {compareMode ? t.chat.compareOn : t.chat.compare}
        </button>
        </div>
      </div>

      {/* Content area: compare view or normal message list */}
      {isComparing ? (
        <CompareView results={compareResults} providerOrder={compareProviderOrder} onPickWinner={handlePickWinner} />
      ) : (
        <MessageList
          messages={currentSession.messages}
          streamingContent={currentStreaming}
          isWaiting={isWaiting}
          onEdit={handleEdit}
          onRegenerate={handleRegenerate}
          onLoadMore={loadMoreMessages}
          hasMore={hasMoreMessages}
        />
      )}

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-950 border-t border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm flex items-start justify-between gap-2">
          <span className="whitespace-pre-line">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-500 hover:text-red-700 underline shrink-0 mt-0.5"
          >
            {t.error.dismiss}
          </button>
        </div>
      )}

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        onAbort={handleAbort}
        isStreaming={isStreaming}
        compareMode={compareMode}
        providers={providers}
        activeProvider={activeProvider}
        onProviderChange={(p) => { setActiveProvider(p || null) }}
      />
    </div>
  )
}
