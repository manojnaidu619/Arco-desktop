/**
 * The global settings dropdown — a gear-icon trigger that opens a small popover
 * with the theme picker, manage-models entry, and a "Usage" link (usage modal).
 * Settings apply app-wide, so this lives in the sidebar footer (not the
 * session navbar).
 *
 * Uses the same lightweight popover pattern as ModelDropdown (a relative
 * container + outside-click/Escape listeners) instead of a menu library.
 */
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/ThemeToggle'
import { ModelManagerModal } from '@/components/ModelManagerModal'
import { cn } from '@/lib/utils'
import { BarChart3, Bot, Settings } from 'lucide-react'

interface Props {
  /** Opens the usage modal (OpenRouter balance + remove key). */
  onOpenUsage: () => void
  /** Open the popover upward instead of downward (for a bottom-anchored trigger). */
  openUp?: boolean
  /** Render a labeled "Settings" row (sidebar) instead of an icon-only button. */
  labeled?: boolean
}

export function SettingsMenu({ onOpenUsage, openUp = false, labeled = false }: Props) {
  const [open, setOpen] = useState(false)
  const [modelsOpen, setModelsOpen] = useState(false)
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

  const openModels = () => {
    setOpen(false)
    setModelsOpen(true)
  }

  return (
    <>
      <div ref={rootRef} className={cn('relative', labeled ? 'w-full' : 'shrink-0')}>
        {labeled ? (
          <Button
            variant="ghost"
            className="h-8 w-full justify-start gap-2 px-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={() => setOpen((o) => !o)}
            title="Settings"
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <Settings className="h-4 w-4 shrink-0" />
            <span>Settings</span>
          </Button>
        ) : (
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
        )}

        {open && (
          <div
            className={cn(
              'absolute z-50 w-56 rounded-lg border border-border bg-popover shadow-xl overflow-hidden',
              labeled ? 'left-0' : 'right-0',
              openUp ? 'bottom-full mb-1' : 'top-full mt-1'
            )}
          >
            {/* Theme */}
            <div className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground">Theme</span>
              <ThemeToggle />
            </div>

            <div className="border-t border-border" />

            {/* Manage models */}
            <button
              onClick={openModels}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted transition-colors"
            >
              <Bot className="h-4 w-4 text-muted-foreground" />
              <span>Manage models</span>
            </button>

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

      <ModelManagerModal open={modelsOpen} onClose={() => setModelsOpen(false)} />
    </>
  )
}
