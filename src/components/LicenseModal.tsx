/**
 * Upgrade / license activation modal.
 *
 * Two paths for users:
 *   1. Purchase Unlimited via Creem checkout (opens in the system browser)
 *   2. Activate an existing license key against the Arco license server
 *
 * Always displays the server's `message` after an activation attempt.
 * Follows the same overlay pattern as SettingsDialog.
 */
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Check, ExternalLink, Loader2, Sparkles, X } from 'lucide-react'

const UNLIMITED_FEATURES = [
  'Compare from 400+ AI models',
  'Unlimited saved conversations',
  'Your data stays on your device (BYOK)',
  'Lifetime license — one payment, no subscription',
  'Free updates',
  'Works on 1 device'
] as const

interface Props {
  onClose: () => void
  /** Called after successful activation so the parent can update badge / hide upgrade button. */
  onActivated: () => void
}

export function LicenseModal({ onClose, onActivated }: Props) {
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null)
  const [licenseKey, setLicenseKey] = useState('')
  const [activating, setActivating] = useState(false)
  const [resultMessage, setResultMessage] = useState<string | null>(null)
  const [resultOk, setResultOk] = useState(false)

  useEffect(() => {
    api.license.getCheckoutUrl().then(setCheckoutUrl)
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !activating) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activating, onClose])

  function openCheckout() {
    if (!checkoutUrl) return
    window.open(checkoutUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleActivate() {
    const trimmed = licenseKey.trim()
    if (!trimmed || activating) return

    setActivating(true)
    setResultMessage(null)

    try {
      const result = await api.license.activate(trimmed)
      setResultMessage(result.message)
      setResultOk(result.ok)
      if (result.ok) {
        onActivated()
      }
    } catch {
      setResultMessage('Something went wrong. Please try again.')
      setResultOk(false)
    } finally {
      setActivating(false)
    }
  }

  const showSuccess = resultOk && resultMessage

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6"
      onClick={() => !activating && onClose()}
    >
      <div
        className="relative w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="icon"
          variant="ghost"
          className="absolute right-3 top-3 h-7 w-7 text-muted-foreground"
          onClick={onClose}
          disabled={activating}
        >
          <X className="h-4 w-4" />
        </Button>

        {showSuccess ? (
          <div className="flex flex-col items-center justify-center px-4 py-12 text-center animate-in fade-in-0 zoom-in-95 duration-300">
            <div
              className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/15"
              aria-hidden="true"
            >
              <Check
                className="h-10 w-10 text-emerald-600 dark:text-emerald-400"
                strokeWidth={2.5}
              />
            </div>
            <p className="max-w-xs text-sm font-medium text-emerald-600 dark:text-emerald-400 animate-in fade-in-0 slide-in-from-bottom-2 duration-500 delay-300 fill-mode-both">
              {resultMessage}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4 pr-8">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Upgrade to Unlimited</h2>
            </div>

            {/* Purchase section */}
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Unlimited
              </p>
              <p className="text-2xl font-bold mb-1">
                $39{' '}
                <span className="text-sm font-normal text-muted-foreground">one-time</span>
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                Lifetime license — one payment, no subscription
              </p>
              <ul className="space-y-1.5 mb-4">
                {UNLIMITED_FEATURES.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                onClick={openCheckout}
                disabled={!checkoutUrl}
              >
                <ExternalLink className="h-4 w-4" />
                {checkoutUrl ? 'Get full access' : 'Checkout unavailable'}
              </Button>
            </div>

            <div className="my-6 border-t border-border" aria-hidden="true" />

            {/* Activation section */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Already have a key?
              </p>
              <input
                type="text"
                placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleActivate()
                }}
                disabled={activating}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md outline-none focus:ring-1 focus:ring-ring font-mono"
                aria-label="License key"
              />
              <Button
                variant="outline"
                className="w-full"
                onClick={handleActivate}
                disabled={activating || !licenseKey.trim()}
              >
                {activating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Activating…
                  </>
                ) : (
                  'Activate license'
                )}
              </Button>

              {resultMessage && !resultOk && (
                <p className="mt-3 text-xs text-destructive">{resultMessage}</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
