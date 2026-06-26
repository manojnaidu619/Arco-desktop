/**
 * Shared add/remove UI for the user's saved model library.
 *
 * Renders a scrollable model list (management mode) and an input to validate
 * and add new OpenRouter model IDs. Used inline during onboarding and inside
 * ModelManagerModal from Settings or pane dropdowns.
 *
 * @used-by Onboarding, ModelManagerModal
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { useEffect, useRef } from 'react'
import { ModelList, savedOpenRouterModelIds } from '@/components/model/ModelList'
import { ModelInput } from '@/components/model/ModelInput'
import { useSavedModels } from '@/hooks/useSavedModels'
import { Loader2 } from 'lucide-react'

/**
 * Inline panel for managing saved models — list with remove buttons and add input.
 *
 * @returns the model manager panel UI
 */
export function ModelManagerPanel({ showExploreLink = false }: { showExploreLink?: boolean }) {
  const { savedModels, loading, add, remove } = useSavedModels()
  const listScrollRef = useRef<HTMLDivElement>(null)
  const scrollToTopAfterAddRef = useRef(false)

  // Scroll the list to the top after a new model is rendered (newest rows appear first)
  useEffect(() => {
    if (!scrollToTopAfterAddRef.current) return
    scrollToTopAfterAddRef.current = false
    listScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [savedModels])

  /**
   * Remove a model from the user's library.
   * Prevents removal if it would leave the library empty (must have at least one model).
   */
  const handleRemove = async (openRouterModelId: string) => {
    if (savedModels.length <= 1) return
    await remove(openRouterModelId)
  }

  /**
   * Validate and add a new model to the library.
   * Throws an error if validation fails (consumed by ModelInput for error display).
   */
  const handleAdd = async (openRouterModelId: string, color: string) => {
    const result = await add(openRouterModelId, color)
    if (!result.ok) {
      throw new Error(result.error ?? 'Could not add model.')
    }
    scrollToTopAfterAddRef.current = true
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Your models</p>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : (
          <div ref={listScrollRef} className="rounded-lg border border-border max-h-60 overflow-y-auto">
            <ModelList
              openRouterModelIds={savedOpenRouterModelIds(savedModels)}
              savedModels={savedModels}
              onRemove={handleRemove}
              removeDisabled={savedModels.length <= 1}
            />
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Add new model</p>
        <ModelInput
          onAdd={handleAdd}
          disabled={loading}
          existingOpenRouterModelIds={savedOpenRouterModelIds(savedModels)}
          showExploreLink={showExploreLink}
        />
      </div>
    </div>
  )
}
