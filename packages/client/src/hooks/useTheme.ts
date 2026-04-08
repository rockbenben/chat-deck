import { useState, useEffect, useCallback } from 'react'

type Theme = 'light' | 'dark'

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('prompthub-theme')
    if (stored === 'dark' || stored === 'light') return stored
  } catch {}
  // Follow OS preference
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('prompthub-theme', theme)
  }, [theme])

  const toggle = useCallback(() => {
    setThemeState(t => t === 'light' ? 'dark' : 'light')
  }, [])

  return { theme, toggle }
}
