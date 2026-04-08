import { useAppStore } from '../../stores/appStore'
import { useI18n } from '../../i18n'
import { Button } from '../ui/button'
import { Sheet, SheetContent, SheetTrigger } from '../ui/sheet'
import { Menu, ChevronLeft } from 'lucide-react'
import { ProfileSidebar } from './ProfileSidebar'
import { SessionList } from './SessionList'

export function MobileNav() {
  const selectedProfileId = useAppStore(s => s.selectedProfileId)
  const selectedSessionId = useAppStore(s => s.selectedSessionId)
  const selectSession = useAppStore(s => s.selectSession)
  const { t } = useI18n()

  return (
    <div className="md:hidden flex items-center gap-2 border-b px-3 py-2">
      {/* Profile drawer */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0">
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-72">
          <ProfileSidebar />
        </SheetContent>
      </Sheet>

      {/* Session drawer (when profile is selected) */}
      {selectedProfileId && (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="text-xs">
              {t.mobile.sessions}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72">
            <SessionList />
          </SheetContent>
        </Sheet>
      )}

      {/* Back to sessions on mobile when in chat */}
      {selectedSessionId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => selectSession(null)}
          className="text-xs"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {t.mobile.back}
        </Button>
      )}

      <span className="text-sm font-semibold ml-auto mr-1">{t.app.name}</span>
    </div>
  )
}
