/**
 * Modal shown when user attempts navigation while streaming is in progress.
 * Single OK button; dismiss on backdrop or Escape.
 * Follows the same overlay pattern as SettingsDialog.
 */
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
  title: string
  message: string
  onClose: () => void
}

export function GenerationInProgressDialog({ title, message, onClose }: Props) {
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
        aria-labelledby="generation-progress-dialog-title"
        aria-describedby="generation-progress-dialog-message"
      >
        <h2 id="generation-progress-dialog-title" className="text-sm font-semibold mb-2">
          {title}
        </h2>
        <p id="generation-progress-dialog-message" className="text-sm text-muted-foreground leading-relaxed">
          {message}
        </p>
        <Button className="w-full mt-4" onClick={onClose}>
          OK
        </Button>
      </div>
    </div>
  )
}
