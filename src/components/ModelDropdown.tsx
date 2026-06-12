/**
 * A pane's model selector — a lightweight popover (no extra deps).
 *
 * Shows the current model with a colored dot + chevron. Opening it lists the
 * curated models and the user's saved custom models (each selectable), with an
 * "add any OpenRouter model id" input pinned at the bottom. The same model may
 * be chosen in multiple panes — there's no de-duplication.
 */
import { useEffect, useRef, useState } from 'react'
import { CURATED_MODELS, getModelDef } from '@shared/models'
import { useCustomModels } from '@/hooks/useCustomModels'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, Plus, X } from 'lucide-react'

interface Props {
  /** Currently selected model id, or null for an empty pane. */
  value: string | null
  onSelect: (modelId: string) => void
}

export function ModelDropdown({ value, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [customId, setCustomId] = useState('')
  const { customModels, add, remove } = useCustomModels()
  const rootRef = useRef<HTMLDivElement>(null)

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

  const choose = (modelId: string) => {
    onSelect(modelId)
    setOpen(false)
  }

  const addCustom = async () => {
    const id = customId.trim()
    if (!id) return
    await add(id)
    setCustomId('')
    choose(id)
  }

  const current = value ? getModelDef(value) : null

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 min-w-0 max-w-full rounded-md px-1.5 py-1 hover:bg-muted/70 transition-colors"
        title={value ?? 'Select a model'}
      >
        <span className={cn('w-2.5 h-2.5 rounded-full shrink-0', current?.color ?? 'bg-muted-foreground/40')} />
        <span className="text-sm font-medium truncate">{current?.label ?? 'Select a model'}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
          <div className="max-h-72 overflow-y-auto py-1">
            <ModelRow
              models={CURATED_MODELS.map((m) => ({ id: m.id, label: m.label }))}
              heading="Curated"
              value={value}
              onChoose={choose}
            />
            {customModels.length > 0 && (
              <ModelRow
                models={customModels.map((id) => ({ id, label: getModelDef(id).label }))}
                heading="Your models"
                value={value}
                onChoose={choose}
                onRemove={remove}
              />
            )}
          </div>

          {/* Add a new custom model id */}
          <div className="flex items-center gap-1.5 border-t border-border p-2">
            <Input
              placeholder="openai/gpt-4o"
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustom()}
              className="h-7 text-xs"
            />
            <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={addCustom} disabled={!customId.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/** A labelled group of selectable model rows inside the dropdown. */
function ModelRow({
  models,
  heading,
  value,
  onChoose,
  onRemove
}: {
  models: { id: string; label: string }[]
  heading: string
  value: string | null
  onChoose: (id: string) => void
  onRemove?: (id: string) => void
}) {
  return (
    <div className="py-1">
      <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{heading}</p>
      {models.map((m) => (
        <div key={m.id} className="group flex items-center">
          <button
            onClick={() => onChoose(m.id)}
            className="flex flex-1 items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors min-w-0"
          >
            <span className={cn('w-2 h-2 rounded-full shrink-0', getModelDef(m.id).color)} />
            <span className="truncate">{m.label}</span>
            {value === m.id && <Check className="h-3.5 w-3.5 ml-auto shrink-0 text-foreground" />}
          </button>
          {onRemove && (
            <button
              onClick={() => onRemove(m.id)}
              className="px-2 text-muted-foreground/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              title="Remove from your models"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
