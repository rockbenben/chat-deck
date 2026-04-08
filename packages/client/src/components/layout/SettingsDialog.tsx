import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../i18n'
import { api } from '../../lib/api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { ScrollArea } from '../ui/scroll-area'

const PROVIDERS = [
  { key: 'anthropic', name: 'claude-code', label: 'Claude', placeholder: 'sk-ant-...', hint: 'console.anthropic.com', needsKey: false },
  { key: 'openai', name: 'codex', label: 'OpenAI', placeholder: 'sk-...', hint: 'platform.openai.com', needsKey: true },
  { key: 'gemini', name: 'gemini', label: 'Gemini', placeholder: 'AIza...', hint: 'aistudio.google.com/apikey', needsKey: true },
  { key: 'qwen', name: 'qwen', label: 'Qwen', placeholder: 'sk-...', hint: 'chat.qwen.ai', needsKey: false },
  { key: 'deepseek', name: 'deepseek', label: 'DeepSeek', placeholder: 'sk-...', hint: 'platform.deepseek.com', needsKey: true },
  { key: 'groq', name: 'groq', label: 'Groq', placeholder: 'gsk_...', hint: 'console.groq.com', needsKey: true },
  { key: '', name: 'ollama', label: 'Ollama', placeholder: '', hint: 'localhost:11434 (local)', needsKey: false },
]

type TestResult = { ok: boolean; mode: string; time: number; error?: string } | null

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n()
  const [maskedKeys, setMaskedKeys] = useState<Record<string, string>>({})
  const [enabledProviders, setEnabledProviders] = useState<Record<string, boolean>>({})
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({})
  const [testing, setTesting] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (!open) return
    setInputs({})
    setTouched(new Set())
    setMessage(null)
    setTestResults({})
    api.config.get().then(c => {
      setMaskedKeys(c.apiKeys)
      setEnabledProviders(c.enabledProviders)
    }).catch(() => {})
  }, [open])

  const handleChange = (key: string, value: string) => {
    setInputs(prev => ({ ...prev, [key]: value }))
    setTouched(prev => new Set(prev).add(key))
  }

  const handleClear = (key: string) => {
    setInputs(prev => ({ ...prev, [key]: '' }))
    setTouched(prev => new Set(prev).add(key))
  }

  const handleToggle = async (name: string) => {
    const next = { ...enabledProviders, [name]: !enabledProviders[name] }
    setEnabledProviders(next)
    try {
      await api.config.updateEnabledProviders({ [name]: next[name] })
      await useAppStore.getState().loadProviders()
    } catch {}
  }

  const handleTest = useCallback(async (providerName: string) => {
    setTesting(prev => ({ ...prev, [providerName]: true }))
    setTestResults(prev => ({ ...prev, [providerName]: null }))
    try {
      const result = await api.config.testProvider(providerName)
      setTestResults(prev => ({ ...prev, [providerName]: result }))
    } catch {
      setTestResults(prev => ({ ...prev, [providerName]: { ok: false, mode: 'error', time: 0, error: 'Request failed' } }))
    } finally {
      setTesting(prev => ({ ...prev, [providerName]: false }))
    }
  }, [])

  const handleTestAll = () => {
    const enabled = PROVIDERS.filter(p => enabledProviders[p.name] !== false)
    enabled.forEach(p => handleTest(p.name))
  }

  const handleSave = async () => {
    const changed: Record<string, string> = {}
    for (const key of touched) {
      changed[key] = inputs[key] ?? ''
    }
    if (Object.keys(changed).length === 0) return
    setSaving(true)
    setMessage(null)
    try {
      const result = await api.config.updateApiKeys(changed)
      setMaskedKeys(result.apiKeys)
      setTouched(new Set())
      setInputs({})
      await useAppStore.getState().loadProviders()
      setMessage(t.settings.saved)
    } catch (e) {
      setMessage(e instanceof Error ? e.message : t.error.failedToSave)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t.settings.title}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-5 py-2">
            {/* Test All */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t.settings.description}
              </p>
              <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={handleTestAll}>
                {t.settings.testAll}
              </Button>
            </div>

            {PROVIDERS.map(p => {
              const hasSaved = !!maskedKeys[p.key]
              const isTouched = touched.has(p.key)
              const displayValue = isTouched ? (inputs[p.key] ?? '') : ''
              const enabled = enabledProviders[p.name] !== false
              const result = testResults[p.name]
              const isTesting = testing[p.name]

              return (
                <div key={p.key} className={`rounded-lg border p-3 space-y-2 transition-opacity ${enabled ? '' : 'opacity-50'}`}>
                  {/* Header: label + toggle + test */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggle(p.name)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${enabled ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${enabled ? 'left-4' : 'left-0.5'}`} />
                      </button>
                      <span className="text-sm font-medium">{p.label}</span>
                      {p.needsKey && !hasSaved && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300">
                          {t.settings.needsKey}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Test result badge */}
                      {result && (
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${result.ok ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' : 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'}`}>
                          {result.ok ? `${t.settings.ok} ${(result.time / 1000).toFixed(1)}s` : t.settings.fail}
                        </span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-6 px-2"
                        onClick={() => handleTest(p.name)}
                        disabled={isTesting || !enabled}
                      >
                        {isTesting ? t.settings.testing : t.settings.test}
                      </Button>
                    </div>
                  </div>

                  {/* Test error detail */}
                  {result && !result.ok && result.error && (
                    <p className="text-[11px] text-red-500 whitespace-pre-line">{result.error}</p>
                  )}

                  {/* API Key input */}
                  {enabled && (
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value={displayValue}
                        onChange={e => handleChange(p.key, e.target.value)}
                        placeholder={hasSaved ? maskedKeys[p.key] : p.placeholder}
                        className="flex-1 h-8 text-xs"
                      />
                      {hasSaved && !isTouched && (
                        <Button variant="outline" size="sm" className="shrink-0 text-xs h-8 text-red-500" onClick={() => handleClear(p.key)}>
                          Clear
                        </Button>
                      )}
                    </div>
                  )}
                  {enabled && (
                    <p className="text-[11px] text-muted-foreground">
                      {hasSaved && !isTouched ? `${t.settings.configured} (${maskedKeys[p.key]})` : p.needsKey ? `${t.settings.required}: ${p.hint}` : `${t.settings.optional}: ${p.hint}`}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </ScrollArea>

        {message && (
          <p className={`text-sm px-1 ${message === t.settings.saved ? 'text-green-600' : 'text-red-500'}`}>
            {message}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose}>{t.settings.close}</Button>
          {touched.size > 0 && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? t.settings.savingKeys : t.settings.saveKeys}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
