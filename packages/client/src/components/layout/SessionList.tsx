import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../i18n'
import { api } from '../../lib/api'
import { ScrollArea } from '../ui/scroll-area'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Plus, Search, MoreHorizontal, Pencil, Trash2, Archive, GitFork } from 'lucide-react'

export function SessionList() {
  // Individual selectors prevent re-rendering on every streaming chunk
  // (streamingContent changes frequently but SessionList doesn't use it)
  const sessions = useAppStore(s => s.sessions)
  const selectedProfileId = useAppStore(s => s.selectedProfileId)
  const selectedSessionId = useAppStore(s => s.selectedSessionId)
  const selectSession = useAppStore(s => s.selectSession)
  const createSession = useAppStore(s => s.createSession)
  const archiveSession = useAppStore(s => s.archiveSession)
  const loadSessions = useAppStore(s => s.loadSessions)
  const { t } = useI18n()

  const timeAgo = useCallback((dateStr: string): string => {
    const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
    if (isNaN(seconds)) return ''
    if (seconds < 60) return t.time.justNow
    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return `${minutes}${t.time.mAgo}`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}${t.time.hAgo}`
    const days = Math.floor(hours / 24)
    return `${days}${t.time.dAgo}`
  }, [t])

  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const editRef = useRef<HTMLInputElement>(null)
  const renameSubmittedRef = useRef(false)

  const filtered = useMemo(() => {
    let list = sessions
    if (search.trim()) {
      const q = search.toLowerCase()
      list = sessions.filter(s =>
        s.title.toLowerCase().includes(q) ||
        s.messages.some(m => m.content.toLowerCase().includes(q))
      )
    }
    // Group forks after their parent for visual hierarchy
    const roots = list.filter(s => !s.parentId)
    const forkMap = new Map<string, typeof list>()
    for (const s of list) {
      if (s.parentId) {
        const arr = forkMap.get(s.parentId) || []
        arr.push(s)
        forkMap.set(s.parentId, arr)
      }
    }
    const result: typeof list = []
    const seen = new Set<string>()
    for (const root of roots) {
      result.push(root)
      seen.add(root.id)
      const forks = forkMap.get(root.id)
      if (forks) {
        for (const fork of forks) {
          result.push(fork)
          seen.add(fork.id)
        }
      }
    }
    // Include orphaned forks (parent not in current list)
    for (const s of list) {
      if (s.parentId && !seen.has(s.id)) result.push(s)
    }
    return result
  }, [sessions, search])

  // Debounce search to avoid scanning all message content per keystroke
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 200)
    return () => clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (editingId && editRef.current) {
      editRef.current.focus()
      editRef.current.select()
    }
  }, [editingId])

  if (!selectedProfileId) return null

  const handleNewSession = async () => {
    try {
      await createSession(selectedProfileId, 'New Chat')
    } catch {
      // Creation failed — user stays on current view
    }
  }

  const handleStartRename = (sessionId: string, currentTitle: string) => {
    renameSubmittedRef.current = false
    setEditingId(sessionId)
    setEditTitle(currentTitle)
  }

  const handleRenameSubmit = async () => {
    if (renameSubmittedRef.current || !editingId || !editTitle.trim()) {
      setEditingId(null)
      return
    }
    renameSubmittedRef.current = true
    try {
      await api.sessions.update(editingId, { title: editTitle.trim() })
      if (selectedProfileId) await loadSessions(selectedProfileId)
    } catch {
      // Rename failed — old title is kept
    }
    setEditingId(null)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRenameSubmit()
    if (e.key === 'Escape') setEditingId(null)
  }

  const handleDelete = async (sessionId: string) => {
    if (!window.confirm('Delete this session? This action cannot be undone.')) return
    try {
      await api.sessions.delete(sessionId)
      if (selectedSessionId === sessionId) selectSession(null)
      if (selectedProfileId) await loadSessions(selectedProfileId)
    } catch {
      // Delete failed — session preserved
    }
  }

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="p-3 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {t.session.sessions}
        </span>
        <Button size="sm" variant="default" className="h-7 text-xs" onClick={handleNewSession}>
          <Plus className="w-3 h-3 mr-1" />
          {t.session.new}
        </Button>
      </div>

      <div className="px-2 pb-2">
        <div className="relative">
          <Search className="absolute left-2 top-2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t.session.searchPlaceholder}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 w-full">
        <div className="px-2 space-y-1 overflow-hidden">
          {filtered.map((session) => (
            <div
              key={session.id}
              onClick={() => selectSession(session.id)}
              onDoubleClick={() => handleStartRename(session.id, session.title)}
              className={`
                group rounded-lg py-2 cursor-pointer transition-colors
                ${session.parentId ? 'ml-4' : ''}
                ${selectedSessionId === session.id
                  ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'}
              `}
            >
              {/* Fixed grid: text takes all space minus 28px for button */}
              <div className="grid grid-cols-[1fr_28px] items-center px-3">
                <div className="overflow-hidden">
                  {editingId === session.id ? (
                    <input
                      ref={editRef}
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onBlur={handleRenameSubmit}
                      onKeyDown={handleRenameKeyDown}
                      className="text-sm w-full bg-white dark:bg-slate-800 border border-blue-300 rounded px-1 py-0.5 outline-none"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <div className={`text-sm truncate flex items-center gap-1 ${
                      selectedSessionId === session.id ? 'font-semibold text-blue-800 dark:text-blue-200' : 'text-foreground'
                    }`}>
                      {session.parentId && <GitFork className="w-3 h-3 text-slate-400 shrink-0" />}
                      {session.title}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {timeAgo(session.updatedAt)}
                    {session.messages.length > 0 && ` · ${session.messages.length} ${t.session.msgs}`}
                  </div>
                </div>

                {/* Action button — fixed 28px column, never squeezed */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      onClick={(e) => e.stopPropagation()}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 transition-opacity justify-self-center"
                    >
                      <MoreHorizontal className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-36">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleStartRename(session.id, session.title) }}>
                      <Pencil className="w-3.5 h-3.5 mr-2" />
                      {t.session.rename}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); archiveSession(session.id) }}>
                      <Archive className="w-3.5 h-3.5 mr-2" />
                      {t.session.archive}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={(e) => { e.stopPropagation(); handleDelete(session.id) }}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2" />
                      {t.session.delete}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              {search ? t.session.noMatching : t.session.noSessions}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
