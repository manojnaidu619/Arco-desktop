/**
 * The header settings dropdown — a gear-icon trigger that opens a small popover
 * with the theme picker and a "Usage" entry (which opens the usage modal).
 *
 * Uses the same lightweight popover pattern as ModelDropdown (a relative
 * container + outside-click/Escape listeners) instead of a menu library.
 */
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { BarChart3, Settings } from 'lucide-react'

interface Props {
  /** Opens the usage modal (OpenRouter balance + remove key). */
  onOpenUsage: () => void
}

export function SettingsMenu({ onOpenUsage }: Props) {
  const [open, setOpen] = useState(false)
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

  const openUsage = () => {
    setOpen(false)
    onOpenUsage()
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-muted-foreground"
        onClick={() => setOpen((o) => !o)}
        title="Settings"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Settings className="h-4 w-4" />
      </Button>

      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 w-56 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
          {/* Theme */}
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>

          <div className="border-t border-border" />

          {/* Usage */}
          <button
            onClick={openUsage}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
          >
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
            <span>Usage</span>
          </button>
        </div>
      )}
    </div>
  )
}
