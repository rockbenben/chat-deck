import { useState, useEffect } from 'react'
import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../i18n'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

export function ProfileEditor() {
  const { t } = useI18n()
  const editingProfile = useAppStore(s => s.editingProfile)
  const providers = useAppStore(s => s.providers)
  const profileEditorOpen = useAppStore(s => s.profileEditorOpen)
  const closeProfileEditor = useAppStore(s => s.closeProfileEditor)
  const createProfile = useAppStore(s => s.createProfile)
  const updateProfile = useAppStore(s => s.updateProfile)
  const loadProviders = useAppStore(s => s.loadProviders)

  // Retry loading providers when dialog opens with empty list
  useEffect(() => {
    if (profileEditorOpen && providers.length === 0) {
      loadProviders()
    }
  }, [profileEditorOpen, providers.length, loadProviders])

  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [cliProvider, setCliProvider] = useState('')
  const [icon, setIcon] = useState('')
  const [stateless, setStateless] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isEditing = !!editingProfile

  useEffect(() => {
    if (editingProfile) {
      setName(editingProfile.name)
      setSystemPrompt(editingProfile.systemPrompt)
      setCliProvider(editingProfile.cliProvider)
      setIcon(editingProfile.icon || '')
      setStateless(editingProfile.stateless ?? false)
    } else {
      setName('')
      setSystemPrompt('')
      setCliProvider(providers.find(p => p.installed)?.name || '')
      setIcon('')
      setStateless(true)
    }
  }, [editingProfile, providers])

  const handleSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const input = { name, systemPrompt, cliProvider, icon: icon || undefined, stateless }
      if (isEditing) {
        await updateProfile(editingProfile.id, input)
      } else {
        await createProfile(input)
      }
      closeProfileEditor()
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : t.error.failedToSave)
    } finally {
      setSubmitting(false)
    }
  }

  const isValid = name.trim() && systemPrompt.trim() && cliProvider

  return (
    <Dialog open={profileEditorOpen} onOpenChange={(open) => !open && closeProfileEditor()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? t.profile.editProfile : t.profile.newProfile}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t.profile.name}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.profile.namePlaceholder}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t.profile.icon}</label>
            <Input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              placeholder={t.profile.iconPlaceholder}
              className="w-20"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t.profile.cliProvider}</label>
            <Select value={cliProvider} onValueChange={setCliProvider}>
              <SelectTrigger>
                <SelectValue placeholder={t.profile.selectProvider} />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.name} value={p.name} disabled={!p.installed}>
                    {p.name} ({p.command}){!p.installed && ` — ${t.profile.notInstalled}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t.profile.systemPrompt}</label>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={t.profile.systemPromptPlaceholder}
              rows={8}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={stateless}
              onChange={(e) => setStateless(e.target.checked)}
              className="rounded border-input"
            />
            <span className="text-sm font-medium">{t.profile.stateless}</span>
            <span className="text-xs text-muted-foreground">{t.profile.statelessHint}</span>
          </label>
        </div>

        {submitError && (
          <p className="text-sm text-red-500 px-1">{submitError}</p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={closeProfileEditor}>{t.profile.cancel}</Button>
          <Button onClick={handleSubmit} disabled={!isValid || submitting}>
            {submitting ? t.profile.saving : isEditing ? t.profile.save : t.profile.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
