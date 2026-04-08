import { useEffect, useRef } from 'react'

interface ShortcutHandlers {
  onNewSession?: () => void
  onToggleCompare?: () => void
  onEscape?: () => void
  onExport?: () => void
  onSwitchProvider?: (index: number) => void
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  const ref = useRef(handlers)
  ref.current = handlers

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      const target = e.target as HTMLElement
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable

      if (ctrl && e.key === 'n' && !isInput) {
        e.preventDefault()
        ref.current.onNewSession?.()
        return
      }

      if (ctrl && e.key === '/' && !isInput) {
        e.preventDefault()
        ref.current.onToggleCompare?.()
        return
      }

      if (ctrl && e.key === 'e' && !isInput) {
        e.preventDefault()
        ref.current.onExport?.()
        return
      }

      if (ctrl && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault()
        ref.current.onSwitchProvider?.(parseInt(e.key, 10) - 1)
        return
      }

      if (e.key === 'Escape' && !isInput) {
        ref.current.onEscape?.()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
}
