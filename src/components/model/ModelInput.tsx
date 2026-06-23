/**
 * Shared input for adding an OpenRouter model by id.
 *
 * Validates the id against OpenRouter (via the backend) before calling
 * `onAdd`. Used in onboarding and the model manager modal.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { useState } from 'react'
import { api } from '@/lib/api'
import { randomHexColor } from '@shared/models'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AlertCircle, Loader2, Plus } from 'lucide-react'

interface Props {
  /** Called with a validated model id and chosen color after OpenRouter confirms it exists. */
  onAdd: (modelId: string, color: string) => void | Promise<void>
  /** Disable the input (e.g. while parent is saving). */
  disabled?: boolean
  placeholder?: string
  /** When true, skip the backend validation call (onboarding local selection). */
  skipValidation?: boolean
  /** Model ids already present — blocks duplicate adds with an inline message. */
  existingModels?: string[]
}

export function ModelInput({
  onAdd,
  disabled = false,
  placeholder = 'openai/gpt-4o',
  skipValidation = false,
  existingModels = []
}: Props) {
  const [value, setValue] = useState('')
  const [color, setColor] = useState(randomHexColor)
  const [validating, setValidating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const id = value.trim()
    if (!id || validating || disabled) return

    setValidating(true)
    setError(null)

    try {
      if (existingModels.includes(id)) {
        setError('This model is already in your list.')
        return
      }

      if (!skipValidation) {
        const result = await api.settings.validateModel(id)
        if (!result.ok) {
          setError(result.error ?? 'That model could not be validated.')
          return
        }
      }

      await onAdd(id, color)
      setValue('')
      setColor(randomHexColor())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add model.')
    } finally {
      setValidating(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Input
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            if (error) setError(null)
          }}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          className="h-8 text-xs flex-1 min-w-0"
          disabled={disabled || validating}
        />
        <label
          className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-border"
          title="Pick a color for this model"
        >
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={disabled || validating}
            className="absolute inset-0 h-full w-full cursor-pointer border-0 p-0 opacity-0"
          />
          <span
            className="absolute inset-0 rounded-md"
            style={{ backgroundColor: color }}
            aria-hidden
          />
        </label>
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0"
          onClick={submit}
          disabled={!value.trim() || disabled || validating}
        >
          {validating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          Add
        </Button>
      </div>
      {error && (
        <div className="flex items-start gap-2 text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-xs">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">Paste any OpenRouter model ID (e.g. openai/gpt-4o)</p>
    </div>
  )
}
