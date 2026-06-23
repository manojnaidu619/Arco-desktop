/**
 * Shared list component for displaying OpenRouter models.
 *
 * Supports two modes:
 *   • Selection (onboarding) — checkboxes to toggle models in a set
 *   • Management (modal) — delete buttons to remove saved models
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { getModelDef } from '@shared/models'
import { cn } from '@/lib/utils'
import { Check, X } from 'lucide-react'

interface Props {
  /** OpenRouter model ids to render. */
  models: string[]
  /** Optional section heading above the list. */
  heading?: string
  /** When true, rows show checkboxes and call onToggle. */
  selectable?: boolean
  /** Currently selected ids (selection mode only). */
  selected?: Set<string>
  /** Toggle a model in/out of the selection set. */
  onToggle?: (modelId: string) => void
  /** When set, rows show a delete button (management mode). */
  onRemove?: (modelId: string) => void
  /** Disable delete buttons (e.g. when only one model remains). */
  removeDisabled?: boolean
  /** Highlight the active pane model (dropdown mode). */
  activeModelId?: string | null
  /** Select a model (dropdown mode — no checkbox). */
  onSelect?: (modelId: string) => void
}

export function ModelList({
  models,
  heading,
  selectable = false,
  selected,
  onToggle,
  onRemove,
  removeDisabled = false,
  activeModelId,
  onSelect
}: Props) {
  if (models.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-muted-foreground text-center">
        No models yet. Add one below.
      </p>
    )
  }

  return (
    <div className="py-1">
      {heading && (
        <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {heading}
        </p>
      )}
      {models.map((id) => {
        const def = getModelDef(id)
        const isSelected = selected?.has(id)
        const isActive = activeModelId === id
        const interactive = selectable || Boolean(onSelect)

        return (
          <div key={id} className="group flex items-start">
            <button
              type="button"
              onClick={() => {
                if (selectable) onToggle?.(id)
                else onSelect?.(id)
              }}
              disabled={!interactive}
              className={cn(
                'flex flex-1 items-start gap-2 px-3 py-1.5 text-left min-w-0',
                interactive && 'hover:bg-muted transition-colors'
              )}
            >
              {selectable && (
                <span
                  className={cn(
                    'mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                    isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                  )}
                >
                  {isSelected && <Check className="h-3 w-3" />}
                </span>
              )}
              <span className={cn('w-2 h-2 rounded-full shrink-0 mt-1.5', def.color)} />
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm truncate leading-tight">{def.label}</span>
                <span className="text-xs text-muted-foreground truncate leading-snug mt-0.5">{def.vendor}</span>
              </div>
              {isActive && !selectable && <Check className="h-3.5 w-3.5 shrink-0 mt-1 text-foreground" />}
            </button>
            {onRemove && (
              <button
                type="button"
                onClick={() => onRemove(id)}
                disabled={removeDisabled}
                className="px-2 pt-2.5 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                title="Remove from your models"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
