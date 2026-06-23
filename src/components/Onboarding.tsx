/**
 * First-run gate and model-selection onboarding.
 *
 * Step 1: paste and validate an OpenRouter API key.
 * Step 2: choose at least four models from the suggested list or add custom ids.
 * The key is stored encrypted in the macOS Keychain — never in the renderer.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { ModelInput } from '@/components/model/ModelInput'
import { ModelList } from '@/components/model/ModelList'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import {
  getCuratedColorByModelId,
  getModelDef,
  ONBOARDING_MIN_MODELS,
  ONBOARDING_SUGGESTED_MODELS
} from '@shared/models'
import type { SavedModel } from '@shared/types'
import { AlertCircle, ArrowRight, ExternalLink, KeyRound, LayoutGrid, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'

interface Props {
  /** Called once the user finishes model selection and clicks Get started. */
  onComplete: () => void
  /** Skip the API key step when the key is already stored. */
  initialStep?: 'api-key' | 'model-selection'
}

type ApiKeyPhase = 'enter' | 'validating'

/** Default selection: first four suggested models. */
function defaultSelected(): Set<string> {
  return new Set(ONBOARDING_SUGGESTED_MODELS.slice(0, ONBOARDING_MIN_MODELS).map((m) => m.id))
}

export function Onboarding({ onComplete, initialStep = 'api-key' }: Props) {
  const [step, setStep] = useState<'api-key' | 'model-selection'>(initialStep)

  // ── API key step state ──
  const [key, setKey] = useState('')
  const [apiKeyPhase, setApiKeyPhase] = useState<ApiKeyPhase>('enter')
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)

  // ── Model selection step state ──
  const [selected, setSelected] = useState<Set<string>>(defaultSelected)
  const [extraModels, setExtraModels] = useState<string[]>([])
  const [customColors, setCustomColors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const displayModels = useMemo(() => {
    const suggestedIds = ONBOARDING_SUGGESTED_MODELS.map((m) => m.id)
    const extras = extraModels.filter((id) => !suggestedIds.includes(id))
    return [...suggestedIds, ...extras]
  }, [extraModels])

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

  const toggleModel = (modelId: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(modelId)) next.delete(modelId)
      else next.add(modelId)
      return next
    })
  }

  const addModelToSelection = async (modelId: string, color: string) => {
    if (!displayModels.includes(modelId)) {
      setExtraModels((prev) => [...prev, modelId])
    }
    setCustomColors((prev) => ({ ...prev, [modelId]: color }))
    setSelected((prev) => new Set(prev).add(modelId))
  }

  const finishOnboarding = async () => {
    if (selected.size < ONBOARDING_MIN_MODELS || saving) return
    setSaving(true)
    setSaveError(null)

    try {
      const models: SavedModel[] = [...selected].map((id) => ({
        id,
        label: getModelDef(id).label,
        color: customColors[id] ?? getCuratedColorByModelId(id)
      }))
      await api.settings.setSavedModels(models)
      await api.settings.completeOnboarding()
      onComplete()
    } catch {
      setSaveError('Could not save your models. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (step === 'model-selection') {
    const count = selected.size
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
                Select at least {ONBOARDING_MIN_MODELS} models to get started. You can change these anytime in Settings.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <ModelList
              models={displayModels}
              colorOverrides={customColors}
              heading="Suggested models"
              selectable
              selected={selected}
              onToggle={toggleModel}
            />
          </div>

          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
              Add custom model
            </p>
            <ModelInput
              onAdd={addModelToSelection}
              disabled={saving}
              existingModels={displayModels}
              skipValidation
            />
          </div>

          <p className="text-sm text-center text-muted-foreground">
            Selected: <span className="font-medium text-foreground">{count}</span> of {ONBOARDING_MIN_MODELS} minimum
          </p>

          {saveError && (
            <div className="flex items-start gap-2 text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-xs">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          <Button className="w-full" onClick={finishOnboarding} disabled={!canContinue || saving}>
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
