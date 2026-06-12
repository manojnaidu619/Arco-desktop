/**
 * First-run gate. Shown when no API key is stored. The user pastes their
 * OpenRouter key; we validate it against OpenRouter (via the backend), show
 * their remaining credit as confirmation, and only then unlock the app. The
 * key is stored encrypted in the macOS Keychain — never in the renderer.
 */
import { useState } from 'react'
import { api } from '@/lib/api'
import type { BalanceInfo } from '@shared/api-contract'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertCircle, BrainCircuit, CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'

interface Props {
  /** Called once a valid key has been saved and the user clicks "Get started". */
  onComplete: () => void
}

type Phase = 'enter' | 'validating' | 'success'

/** Format a credit figure as USD, or a friendly fallback. */
function formatCredits(value: number | null): string {
  if (value === null) return 'unlimited'
  return `$${value.toFixed(2)}`
}

export function Onboarding({ onComplete }: Props) {
  const [key, setKey] = useState('')
  const [phase, setPhase] = useState<Phase>('enter')
  const [error, setError] = useState<string | null>(null)
  const [balance, setBalance] = useState<BalanceInfo | null>(null)

  const submit = async () => {
    if (!key.trim() || phase === 'validating') return
    setPhase('validating')
    setError(null)

    const result = await api.settings.saveKey(key)
    if (result.ok) {
      setBalance(result.balance ?? null)
      setPhase('success')
    } else {
      setError(result.error ?? 'Could not validate that key.')
      setPhase('enter')
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <BrainCircuit className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Welcome to Multi-Mind</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Compare answers from multiple AI models side by side. Everything stays on your Mac — connect your own
              OpenRouter API key to begin.
            </p>
          </div>
        </div>

        {phase === 'success' ? (
          /* ── Success: show the validated balance and let the user in ── */
          <div className="w-full flex flex-col items-center gap-4">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Your key is valid</span>
            </div>
            <div className="w-full rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
              {balance ? (
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Remaining credit</span>
                    <span className="font-medium">{formatCredits(balance.remaining)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Used so far</span>
                    <span className="font-medium">{formatCredits(balance.totalUsage)}</span>
                  </div>
                  {balance.isFreeTier && (
                    <p className="text-xs text-muted-foreground mt-1">This key is on OpenRouter's free tier.</p>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Connected. Balance details weren't available.</p>
              )}
            </div>
            <Button className="w-full" onClick={onComplete}>
              Get started
            </Button>
          </div>
        ) : (
          /* ── Enter key ── */
          <div className="w-full flex flex-col gap-3">
            <Input
              type="password"
              placeholder="sk-or-v1-…"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              className="h-10 text-sm text-center"
              autoFocus
            />

            {error && (
              <div className="flex items-start gap-2 text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-xs text-left">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <Button className="w-full" onClick={submit} disabled={!key.trim() || phase === 'validating'}>
              {phase === 'validating' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Validating…
                </>
              ) : (
                'Validate & continue'
              )}
            </Button>

            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
            >
              Get an OpenRouter API key
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
