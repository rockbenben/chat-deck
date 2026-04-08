import { create } from 'zustand'
import { en } from './en'
import { zh } from './zh'
import type { Translations } from './en'

export type Locale = 'en' | 'zh'

const locales: Record<Locale, Translations> = { en, zh }

function detectLocale(): Locale {
  const saved = localStorage.getItem('locale')
  if (saved === 'en' || saved === 'zh') return saved
  return navigator.language.startsWith('zh') ? 'zh' : 'en'
}

interface I18nState {
  locale: Locale
  t: Translations
  setLocale: (locale: Locale) => void
}

export const useI18n = create<I18nState>((set) => {
  const initial = detectLocale()
  return {
    locale: initial,
    t: locales[initial],
    setLocale: (locale) => {
      localStorage.setItem('locale', locale)
      set({ locale, t: locales[locale] })
    },
  }
})
