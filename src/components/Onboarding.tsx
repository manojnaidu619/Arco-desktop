/**
 * First-run gate and model-selection onboarding.
 *
 * Step 1: paste and validate an OpenRouter API key.
 * Step 2: manage at least four saved models via the shared ModelManagerPanel
 * (same add/remove UI as Settings). The key is stored encrypted in the macOS
 * Keychain — never in the renderer.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { ModelManagerPanel } from '@/components/model/ModelManagerPanel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSavedModels } from '@/hooks/useSavedModels'
import { api } from '@/lib/api'
import { ONBOARDING_MIN_MODELS, ONBOARDING_SUGGESTED_MODELS } from '@shared/models'
import type { SavedModel } from '@shared/types'
import { AlertCircle, ArrowRight, ExternalLink, KeyRound, LayoutGrid, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Called once the user finishes model selection and clicks Get started. */
  onComplete: () => void
  /** Skip the API key step when the key is already stored. */
  initialStep?: 'api-key' | 'model-selection'
}

type ApiKeyPhase = 'enter' | 'validating'

/** Default starter library: first four suggested curated models. */
function defaultOnboardingModels(): SavedModel[] {
  return ONBOARDING_SUGGESTED_MODELS.slice(0, ONBOARDING_MIN_MODELS).map((m) => ({
    openRouterModelId: m.openRouterModelId,
    label: m.label,
    color: m.color
  }))
}

export function Onboarding({ onComplete, initialStep = 'api-key' }: Props) {
  const [step, setStep] = useState<'api-key' | 'model-selection'>(initialStep)
  const { savedModels, loading, set, refresh } = useSavedModels()
  const seededRef = useRef(false)

  // ── API key step state ──
  const [key, setKey] = useState('')
  const [apiKeyPhase, setApiKeyPhase] = useState<ApiKeyPhase>('enter')
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)

  // ── Model selection step state ──
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Refresh from DB, then seed four defaults when the library is empty (e.g. first visit or after key removal)
  useEffect(() => {
    if (step !== 'model-selection') return

    let cancelled = false
    ;(async () => {
      const models = await refresh()
      if (cancelled || seededRef.current || models.length > 0) return
      seededRef.current = true
      await set(defaultOnboardingModels())
    })().catch(console.error)

    return () => {
      cancelled = true
    }
  }, [step, refresh, set])

  const submitKey = async () => {
    if (!key.trim() || apiKeyPhase === 'validating') return
    setApiKeyPhase('validating')
    setApiKeyError(null)

    const result = await api.settings.saveKey(key)
    if (result.ok) {
      setStep('model-selection')
      setApiKeyPhase('enter')
    } else {
      setApiKeyError(result.error ?? 'Could not validate that key.')
      setApiKeyPhase('enter')
    }
  }

  const finishOnboarding = async () => {
    if (savedModels.length < ONBOARDING_MIN_MODELS || saving) return
    setSaving(true)
    setSaveError(null)

    try {
      await api.settings.completeOnboarding()
      onComplete()
    } catch {
      setSaveError('Could not finish onboarding. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (step === 'model-selection') {
    const count = savedModels.length
    const canContinue = count >= ONBOARDING_MIN_MODELS

    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground p-6">
        <div className="w-full max-w-md flex flex-col gap-6">
          <div className="flex flex-col items-center text-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <LayoutGrid className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Choose Your Models</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Add at least {ONBOARDING_MIN_MODELS} models to get started. You can change these anytime in Settings.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <ModelManagerPanel />
          </div>

          <p className="text-sm text-center text-muted-foreground">
            Saved: <span className="font-medium text-foreground">{count}</span> of {ONBOARDING_MIN_MODELS} minimum
          </p>

          {saveError && (
            <div className="flex items-start gap-2 text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          <Button className="w-full" onClick={finishOnboarding} disabled={!canContinue || saving || loading}>
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                Get started
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground p-6">
      <div className="w-full max-w-md flex flex-col items-center text-center gap-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
            <KeyRound className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Welcome to Arco</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Compare answers from multiple AI models side by side. Everything stays on your Mac — connect your own
              OpenRouter API key to begin.
            </p>
          </div>
        </div>

        <div className="w-full flex flex-col gap-3">
          <Input
            type="password"
            placeholder="sk-or-v1-…"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitKey()}
            className="h-10 text-sm text-center"
            autoFocus
          />

          {apiKeyError && (
            <div className="flex items-start gap-2 text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-xs text-left">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{apiKeyError}</span>
            </div>
          )}

          <Button className="w-full" onClick={submitKey} disabled={!key.trim() || apiKeyPhase === 'validating'}>
            {apiKeyPhase === 'validating' ? (
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
      </div>
    </div>
  )
}
