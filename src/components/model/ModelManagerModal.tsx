/**
 * Modal shell for managing the user's saved model library.
 *
 * Opened from Settings or from a pane's model dropdown ("Add or remove models").
 * Delegates the inner UI to ModelManagerPanel for a consistent UX with onboarding.
 *
 * @used-by SettingsMenu, ModelDropdown
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { useEffect } from 'react'
import { ModelManagerPanel } from '@/components/model/ModelManagerPanel'
import { useSavedModels } from '@/hooks/useSavedModels'
import { Button } from '@/components/ui/button'
import { X } from 'lucide-react'

interface Props {
  /** Whether the modal is currently visible. */
  open: boolean
  /** Callback to close the modal (e.g., clicking backdrop or Done button). */
  onClose: () => void
}

/**
 * Full-screen modal wrapper around the shared model manager panel.
 *
 * @param open — whether the modal is visible
 * @param onClose — called when the user dismisses the modal
 */
export function ModelManagerModal({ open, onClose }: Props) {
  const { refresh } = useSavedModels()

  // Refresh the model list when the modal opens to ensure fresh data
  useEffect(() => {
    if (open) refresh().catch(console.error)
  }, [open, refresh])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold">Manage Models</h2>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <ModelManagerPanel />
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}
