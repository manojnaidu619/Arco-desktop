/**
 * The grid-layout picker (sits to the left of the bottom input bar).
 * Five presets matching the reference: 1, 2, 3 panes in a row, 4 in a 2×2, and
 * 6 in a 3×2. Each is a small glyph button; the active one is highlighted.
 */
import { Columns2, Columns3, Grid2x2, Square } from 'lucide-react'
import { LAYOUTS } from '@/hooks/useChat'
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

interface Props {
  value: number
  onChange: (layout: number) => void
}

export function LayoutSelector({ value, onChange }: Props) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5 shrink-0" role="group" aria-label="Grid layout">
      {LAYOUTS.map((layout) => {
        const { Icon, label } = ICONS[layout]
        return (
          <Button
            key={layout}
            type="button"
            size="icon"
            variant="ghost"
            className={cn('h-8 w-8 rounded-md text-muted-foreground', value === layout && 'bg-muted text-foreground')}
            onClick={() => onChange(layout)}
            title={label}
            aria-label={label}
            aria-pressed={value === layout}
          >
            <Icon className="h-4 w-4" />
          </Button>
        )
      })}
    </div>
  )
}
