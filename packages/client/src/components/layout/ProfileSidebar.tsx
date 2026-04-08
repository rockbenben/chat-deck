import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../i18n'
import { ScrollArea } from '../ui/scroll-area'
import { Button } from '../ui/button'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { ProfileEditor } from '../profile/ProfileEditor'

export function ProfileSidebar() {
  const profiles = useAppStore(s => s.profiles)
  const selectedProfileId = useAppStore(s => s.selectedProfileId)
  const selectProfile = useAppStore(s => s.selectProfile)
  const openProfileEditor = useAppStore(s => s.openProfileEditor)
  const deleteProfile = useAppStore(s => s.deleteProfile)
  const profileEditorOpen = useAppStore(s => s.profileEditorOpen)
  const { t } = useI18n()

  return (
    <div className="h-full bg-slate-50 dark:bg-slate-900 text-foreground flex flex-col border-r">
      <div className="p-3 text-xs uppercase tracking-wider text-muted-foreground">
        {t.profile.profiles}
      </div>

      <ScrollArea className="flex-1">
        <div className="px-2 space-y-1">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              onClick={() => selectProfile(profile.id)}
              className={`
                group rounded-lg px-3 py-2.5 cursor-pointer transition-colors
                ${selectedProfileId === profile.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent text-foreground'}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">
                    {profile.icon && <span className="mr-1.5">{profile.icon}</span>}
                    {profile.name}
                  </div>
                  <div className={`text-xs mt-0.5 ${
                    selectedProfileId === profile.id ? 'opacity-75' : 'text-muted-foreground'
                  }`}>
                    {profile.cliProvider}
                  </div>
                </div>
                <div className="hidden group-hover:flex gap-1 ml-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); openProfileEditor(profile) }}
                    className="p-1 rounded hover:bg-black/10 dark:hover:bg-white/10"
                    aria-label={`Edit ${profile.name}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (window.confirm(`Delete "${profile.name}"? ${t.profile.deleteConfirm}`)) {
                        deleteProfile(profile.id)
                      }
                    }}
                    className="p-1 rounded hover:bg-red-500/20 text-red-500"
                    aria-label={`Delete ${profile.name}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="p-2 border-t">
        <Button
          variant="ghost"
          className="w-full text-muted-foreground hover:text-foreground"
          onClick={() => openProfileEditor(null)}
        >
          <Plus className="w-4 h-4 mr-2" />
          {t.profile.newProfile}
        </Button>
      </div>

      {profileEditorOpen && <ProfileEditor />}
    </div>
  )
}
