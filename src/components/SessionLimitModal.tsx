/**
 * Modal shown when a free-tier user tries to create more than the allowed
 * number of saved conversations. Offers a path to upgrade to Pro.
 * Follows the same overlay pattern as SettingsDialog.
 */
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { MessagesSquare, Sparkles } from 'lucide-react'
import { FREE_TIER_SESSION_LIMIT } from '@shared/license'

interface Props {
  onClose: () => void
  onUpgrade: () => void
}

export function SessionLimitModal({ onClose, onUpgrade }: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="session-limit-dialog-title"
        aria-describedby="session-limit-dialog-message"
      >
        <div className="flex items-center gap-2 mb-2">
          <MessagesSquare className="h-4 w-4 text-primary shrink-0" />
          <h2 id="session-limit-dialog-title" className="text-sm font-semibold">
            Conversation limit reached
          </h2>
        </div>
        <p id="session-limit-dialog-message" className="text-sm text-muted-foreground leading-relaxed">
          The free plan includes up to {FREE_TIER_SESSION_LIMIT} saved conversations. Upgrade to Pro
          to save as many conversations as you need.
        </p>
        <div className="flex flex-col gap-2 mt-4">
          <Button className="w-full" onClick={onUpgrade}>
            <Sparkles className="h-4 w-4" />
            Upgrade to Pro
          </Button>
          <Button variant="outline" className="w-full" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
