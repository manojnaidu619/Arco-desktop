/**
 * A small segmented control for switching between Light / Dark / System
 * themes. Sits in the app header.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

const themes = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor }
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // `theme` is only known after mount (it reads from storage/system), so we
  // render a placeholder of the same size until then to avoid a flicker.
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="h-7 w-[76px] shrink-0" aria-hidden />
  }

  return (
    <div className="flex items-center rounded-md border border-border p-0.5 shrink-0" role="group" aria-label="Theme">
      {themes.map(({ value, label, icon: Icon }) => (
        <Button
          key={value}
          type="button"
          size="icon"
          variant="ghost"
          className={cn('h-6 w-6 rounded-sm', theme === value && 'bg-muted text-foreground')}
          onClick={() => setTheme(value)}
          title={label}
          aria-label={label}
          aria-pressed={theme === value}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      ))}
    </div>
  )
}
