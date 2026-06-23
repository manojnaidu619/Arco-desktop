/**
 * A pane's model selector — a lightweight popover (no extra deps).
 *
 * Lists the user's saved models and offers a link to open the model manager
 * modal for adding or removing models. The same model may be chosen in
 * multiple panes — there's no de-duplication.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { useEffect, useRef, useState } from 'react'
import { getModelDef, resolveModelColor } from '@shared/models'
import { useSavedModels } from '@/hooks/useSavedModels'
import { ModelColorDot } from '@/components/model/ModelColorDot'
import { ModelList, savedOpenRouterModelIds } from '@/components/model/ModelList'
import { ModelManagerModal } from '@/components/model/ModelManagerModal'
import { ChevronDown, Plus } from 'lucide-react'

interface Props {
  /** Currently selected OpenRouter model ID, e.g. "openai/gpt-4o", or null for an empty pane. */
  value: string | null
  onSelect: (openRouterModelId: string) => void
}

export function ModelDropdown({ value, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [managerOpen, setManagerOpen] = useState(false)
  const { savedModels, refresh } = useSavedModels()
  const rootRef = useRef<HTMLDivElement>(null)

  // Refresh from disk whenever the dropdown opens so changes from Settings
  // (or another pane's manager) appear without restarting the app.
  useEffect(() => {
    if (open) refresh().catch(console.error)
  }, [open, refresh])

  // Close on outside-click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const choose = (openRouterModelId: string) => {
    onSelect(openRouterModelId)
    setOpen(false)
  }

  const openManager = () => {
    setOpen(false)
    setManagerOpen(true)
  }

  const closeManager = () => {
    setManagerOpen(false)
    refresh().catch(console.error)
  }

  const current = value ? getModelDef(value) : null
  const currentColor = value ? resolveModelColor(value, savedModels) : undefined

  return (
    <>
      <div ref={rootRef} className="relative min-w-0">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 min-w-0 max-w-full rounded-md px-1.5 py-1 hover:bg-muted/70 transition-colors text-left"
          title={value ?? 'Select a model'}
        >
          {currentColor ? (
            <ModelColorDot color={currentColor} size="md" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-muted-foreground/40" />
          )}
          <div className="flex flex-col min-w-0 flex-1">
            <span className="text-sm font-medium truncate leading-tight">{current?.label ?? 'Select a model'}</span>
            {value && <span className="text-xs text-muted-foreground truncate leading-snug mt-0.5">{value}</span>}
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
            {/* ~4 model rows + section heading before scrolling */}
            <div className="max-h-52 overflow-y-auto py-1">
              <ModelList
                openRouterModelIds={savedOpenRouterModelIds(savedModels)}
                savedModels={savedModels}
                heading="Your models"
                activeOpenRouterModelId={value}
                onSelect={choose}
              />
            </div>

            <button
              type="button"
              onClick={openManager}
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Add or remove models…
            </button>
          </div>
        )}
      </div>

      <ModelManagerModal open={managerOpen} onClose={closeManager} />
    </>
  )
}
