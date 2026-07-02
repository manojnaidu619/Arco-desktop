/**
 * Confirmation modal before deleting a conversation from the sidebar.
 * Follows the same overlay pattern as SessionLimitModal.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'

interface Props {
  title: string
  onConfirm: () => Promise<void>
  onCancel: () => void
  deleting: boolean
}

export function DeleteConversationDialog({ title, onConfirm, onCancel, deleting }: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel, deleting])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={deleting ? undefined : onCancel}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-labelledby="delete-conversation-dialog-title"
        aria-describedby="delete-conversation-dialog-message"
      >
        <div className="flex items-center gap-2 mb-2">
          <Trash2 className="h-4 w-4 text-destructive shrink-0" />
          <h2 id="delete-conversation-dialog-title" className="text-sm font-semibold">
            Delete conversation?
          </h2>
        </div>
        <p id="delete-conversation-dialog-message" className="text-sm text-muted-foreground leading-relaxed">
          <span className="font-medium text-foreground">&ldquo;{title}&rdquo;</span> will be permanently deleted.
          This can&apos;t be undone.
        </p>
        <div className="flex flex-col gap-2 mt-4">
          <Button
            variant="destructive"
            className="w-full"
            disabled={deleting}
            onClick={() => void onConfirm()}
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
          <Button variant="outline" className="w-full" disabled={deleting} onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
