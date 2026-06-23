/**
 * Modal for managing the user's saved model library.
 *
 * Opened from Settings or from a pane's model dropdown ("Add or remove models").
 * Composes ModelList (management mode) and ModelInput for a consistent UX.
 *
 * @used-by MainApp, SettingsMenu, ModelDropdown
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { useEffect } from 'react'
import { useSavedModels } from '@/hooks/useSavedModels'
import { ModelList } from '@/components/model/ModelList'
import { ModelInput } from '@/components/model/ModelInput'
import { Button } from '@/components/ui/button'
import { Loader2, X } from 'lucide-react'

interface Props {
  /** Whether the modal is currently visible. */
  open: boolean
  /** Callback to close the modal (e.g., clicking backdrop or Done button). */
  onClose: () => void
}

export function ModelManagerModal({ open, onClose }: Props) {
  const { savedModels, loading, refresh, add, remove } = useSavedModels()

  // Refresh the model list when the modal opens to ensure fresh data
  useEffect(() => {
    if (open) refresh().catch(console.error)
  }, [open, refresh])

  if (!open) return null

  /**
   * Remove a model from the user's library.
   * Prevents removal if it would leave the library empty (must have at least one model).
   */
  const handleRemove = async (modelId: string) => {
    if (savedModels.length <= 1) return
    await remove(modelId)
  }

  /**
   * Validate and add a new model to the library.
   * Throws an error if validation fails (consumed by ModelInput for error display).
   */
  const handleAdd = async (modelId: string) => {
    const result = await add(modelId)
    if (!result.ok) {
      throw new Error(result.error ?? 'Could not add model.')
    }
  }

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

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Your models</p>
            {loading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : (
              <div className="rounded-lg border border-border max-h-60 overflow-y-auto">
                <ModelList
                  models={savedModels}
                  onRemove={handleRemove}
                  removeDisabled={savedModels.length <= 1}
                />
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Add new model</p>
            <ModelInput onAdd={handleAdd} disabled={loading} existingModels={savedModels} />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-border flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      </div>
    </div>
  )
}
