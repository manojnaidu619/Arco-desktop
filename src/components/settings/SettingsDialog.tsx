/**
 * Usage modal. Lets the user review their OpenRouter credit balance and
 * remove the stored key (which returns the app to the onboarding gate).
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import type { BalanceInfo } from '@shared/api-contract'
import { Button } from '@/components/ui/button'
import { Loader2, LogOut, X } from 'lucide-react'

interface Props {
  /** Called after the key is removed, so the app can show onboarding again. */
  onKeyCleared: () => void
  onClose: () => void
}

function formatCredits(value: number | null): string {
  if (value === null) return 'unlimited'
  return `$${value.toFixed(2)}`
}

export function SettingsDialog({ onKeyCleared, onClose }: Props) {
  const [balance, setBalance] = useState<BalanceInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.settings
      .getBalance()
      .then((result) => {
        if (result.ok) setBalance(result.balance ?? null)
        else setError(result.error ?? 'Could not load balance.')
      })
      .finally(() => setLoading(false))
  }, [])

  const removeKey = async () => {
    await api.settings.clearKey()
    onKeyCleared()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Usage</h2>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">OpenRouter key</p>
            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-sm">
              {loading ? (
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking balance…
                </span>
              ) : error ? (
                <span className="text-destructive text-xs">{error}</span>
              ) : balance ? (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining</span>
                    <span className="font-medium">{formatCredits(balance.remaining)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Used</span>
                    <span className="font-medium">{formatCredits(balance.totalUsage)}</span>
                  </div>
                </div>
              ) : (
                <span className="text-muted-foreground">A key is stored.</span>
              )}
            </div>
          </div>

          <Button variant="destructive" className="w-full" onClick={removeKey}>
            <LogOut className="h-4 w-4" />
            Remove API key
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Removing the key returns you to the welcome screen. Your conversations are kept.
          </p>
        </div>
      </div>
    </div>
  )
}
