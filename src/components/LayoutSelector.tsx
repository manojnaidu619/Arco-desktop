/**
 * The grid-layout picker (sits in the app header, top-right).
 * Five presets matching the reference: 1, 2, 3 panes in a row, 4 in a 2×2, and
 * 6 in a 3×2. Each is a small glyph button; the active one is highlighted.
 *
 * When a preset would show FEWER panes than there are populated models, clicking
 * it opens a selection dropdown so the user picks exactly which models stay
 * visible (capped at the target count), instead of silently keeping the first N.
 */
import { useEffect, useRef, useState } from 'react'
import { Columns2, Columns3, Grid2x2, Square } from 'lucide-react'
import { LAYOUTS } from '@/hooks/useChat'
import { getModelDef } from '@shared/models'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** Custom glyph for the 6-pane (3×2) layout, since lucide has no exact match. */
function Grid3x2({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className={className}>
      <rect x="2.5" y="5" width="5.5" height="6" rx="1" />
      <rect x="9.5" y="5" width="5.5" height="6" rx="1" />
      <rect x="16.5" y="5" width="5.5" height="6" rx="1" />
      <rect x="2.5" y="13" width="5.5" height="6" rx="1" />
      <rect x="9.5" y="13" width="5.5" height="6" rx="1" />
      <rect x="16.5" y="13" width="5.5" height="6" rx="1" />
    </svg>
  )
}

/** Icon + tooltip label per layout preset. */
const ICONS: Record<number, { Icon: React.ComponentType<{ className?: string }>; label: string }> = {
  1: { Icon: Square, label: 'Single pane' },
  2: { Icon: Columns2, label: '2 panes' },
  3: { Icon: Columns3, label: '3 panes' },
  4: { Icon: Grid2x2, label: '4 panes (2×2)' },
  6: { Icon: Grid3x2, label: '6 panes (3×2)' }
}

/** A populated pane the user can choose to keep visible. */
export interface SelectablePane {
  slot: number
  modelId: string
  label: string
}

interface Props {
  value: number
  /** Apply a layout that needs no model selection (target ≥ populated count). */
  onChange: (layout: number) => void
  /** Populated panes (with a model), in current grid order. */
  panes: SelectablePane[]
  /** Slots currently visible (drives the default checked state). */
  visibleSlots: number[]
  /** Commit a chosen set of models for a reduced layout. */
  onApplySelection: (selectedSlots: number[], layout: number) => void
}

export function LayoutSelector({ value, onChange, panes, visibleSlots, onApplySelection }: Props) {
  // Which preset's selection dropdown is open (the target pane count), or null.
  const [pickerFor, setPickerFor] = useState<number | null>(null)
  const [selected, setSelected] = useState<number[]>([])
  const rootRef = useRef<HTMLDivElement>(null)

  // Close on outside-click or Escape.
  useEffect(() => {
    if (pickerFor === null) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setPickerFor(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerFor(null)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [pickerFor])

  const handleClick = (target: number) => {
    // A choice is only needed when REDUCING below the populated count (or
    // re-clicking the current layout to swap which models show). Expanding
    // (target > current layout) just reveals more panes in their existing
    // order, so apply it immediately — same for any target with nothing to drop.
    const needsSelection = panes.length > target && target <= value
    if (!needsSelection) {
      setPickerFor(null)
      onChange(target)
      return
    }
    // Reopen toggles closed; otherwise open with the first `target` visible
    // panes pre-checked (today's first-N winners).
    if (pickerFor === target) {
      setPickerFor(null)
      return
    }
    const defaults = panes.filter((p) => visibleSlots.includes(p.slot)).slice(0, target).map((p) => p.slot)
    setSelected(defaults)
    setPickerFor(target)
  }

  const toggle = (slot: number) => {
    setSelected((prev) => (prev.includes(slot) ? prev.filter((s) => s !== slot) : [...prev, slot]))
  }

  const apply = () => {
    if (pickerFor === null || selected.length !== pickerFor) return
    onApplySelection(selected, pickerFor)
    setPickerFor(null)
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5" role="group" aria-label="Grid layout">
        {LAYOUTS.map((layout) => {
          const { Icon, label } = ICONS[layout]
          return (
            <Button
              key={layout}
              type="button"
              size="icon"
              variant="ghost"
              className={cn('h-8 w-8 rounded-md text-muted-foreground', value === layout && 'bg-muted text-foreground')}
              onClick={() => handleClick(layout)}
              title={label}
              aria-label={label}
              aria-pressed={value === layout}
            >
              <Icon className="h-4 w-4" />
            </Button>
          )
        })}
      </div>

      {pickerFor !== null && (
        <div className="absolute top-full right-0 mt-1 z-50 w-60 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
          <p className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground border-b border-border">
            Show {pickerFor} of {panes.length} — keep which?
          </p>
          <div className="max-h-72 overflow-y-auto py-1">
            {panes.map((p) => {
              const checked = selected.includes(p.slot)
              const atLimit = selected.length >= pickerFor && !checked
              return (
                <button
                  key={p.slot}
                  onClick={() => !atLimit && toggle(p.slot)}
                  disabled={atLimit}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                    atLimit ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                      checked ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                    )}
                  >
                    {checked && (
                      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2.5 6.5L5 9l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <span className={cn('w-2 h-2 rounded-full shrink-0', getModelDef(p.modelId).color)} />
                  <span className="truncate">{p.label}</span>
                </button>
              )
            })}
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border p-2">
            <span className="text-xs text-muted-foreground pl-1">
              {selected.length}/{pickerFor} selected
            </span>
            <Button size="sm" className="h-7 text-xs" onClick={apply} disabled={selected.length !== pickerFor}>
              Apply
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
