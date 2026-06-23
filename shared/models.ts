/**
 * The curated list of models shown as quick-pick checkboxes in the UI.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ HOW TO ADD / CHANGE THE DEFAULT MODELS                                │
 * │ Edit the CURATED_MODELS array below. Each `id` must be a valid        │
 * │ OpenRouter model id (the exact string from openrouter.ai/models,      │
 * │ e.g. "openai/gpt-4o" or "anthropic/claude-3.5-sonnet").               │
 * │                                                                       │
 * │ Users can ALSO paste any model id at runtime via the "Add model"      │
 * │ field — those are stored per-user and merged with this list. So this  │
 * │ array is just the convenient starting set, not a hard limit.          │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * NOTE: confirm these ids against the live OpenRouter catalog for your
 * launch date — model availability changes over time.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */

import type { SavedModel } from './types'

/** Default hex color for models without a curated or saved color. */
export const DEFAULT_MODEL_COLOR = '#64748b'

/** Metadata describing a single selectable model. */
export interface ModelDef {
  /** OpenRouter model id, e.g. "openai/gpt-4o". */
  id: string
  /** Friendly display name. */
  label: string
  /** Provider/vendor shown as a small label. */
  vendor: string
  /** Hex color for the model's colored dot/badge, e.g. "#f43f5e". */
  color: string
}

export const CURATED_MODELS: ModelDef[] = [
  { id: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash', vendor: 'DeepSeek', color: '#06b6d4' },
  { id: 'moonshotai/kimi-k2-thinking', label: 'Kimi K2 Thinking', vendor: 'Moonshot AI', color: '#8b5cf6' },
  { id: 'z-ai/glm-4.7-flash', label: 'GLM-4.7 Flash', vendor: 'Zhipu AI', color: '#3b82f6' },
  { id: 'minimax/minimax-m2.7', label: 'MiniMax M2.7', vendor: 'MiniMax', color: '#f43f5e' },
  { id: 'qwen/qwen3.6-flash', label: 'Qwen 3.6 Flash', vendor: 'Alibaba', color: '#f97316' },
  { id: 'anthropic/claude-opus-4.8', label: 'Claude Opus 4.8', vendor: 'Anthropic', color: '#f59e0b' }
]

/** Minimum models required during onboarding before the user can continue. */
export const ONBOARDING_MIN_MODELS = 4

/** Suggested models shown as checkboxes during onboarding (first six curated). */
export const ONBOARDING_SUGGESTED_MODELS = CURATED_MODELS.slice(0, 6)

/** Generate a random hex color for custom model defaults. */
export function randomHexColor(): string {
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')}`
}

/** Hex color from the curated list, or the default fallback. */
export function getCuratedColorByModelId(id: string): string {
  return CURATED_MODELS.find((m) => m.id === id)?.color ?? DEFAULT_MODEL_COLOR
}

/**
 * Resolve a model id to its display metadata.
 *
 * Falls back to a sensible derived label/vendor for ids that aren't in the
 * curated list (e.g. a custom id the user pasted). This means the UI can
 * render ANY model id gracefully.
 *
 * @example
 *   getModelDef('openai/gpt-4o')
 *   // → { id: 'openai/gpt-4o', label: 'gpt-4o', vendor: 'openai', color: '#64748b' }
 */
export function getModelDef(id: string): ModelDef {
  return (
    CURATED_MODELS.find((m) => m.id === id) ?? {
      id,
      label: id.split('/').pop() ?? id,
      vendor: id.split('/')[0] ?? 'Unknown',
      color: DEFAULT_MODEL_COLOR
    }
  )
}

/** Prefer persisted color from the library; fall back to curated/default. */
export function resolveModelColor(id: string, savedModels?: SavedModel[]): string {
  const saved = savedModels?.find((m) => m.id === id)
  if (saved?.color) return saved.color
  return getCuratedColorByModelId(id)
}

/** Split an OpenRouter model id into provider + model name. */
export function parseModelSlug(fullId: string): { author: string; slug: string } | null {
  const slash = fullId.indexOf('/')
  if (slash === -1) return null
  const author = fullId.slice(0, slash).trim()
  const slug = fullId.slice(slash + 1).trim()
  if (!author || !slug) return null
  return { author, slug }
}

/** Compose the OpenRouter model id from provider + model name. */
export function formatModelSlug(author: string, slug: string): string {
  return `${author}/${slug}`
}

/** True when the model id is in the user's saved library. */
export function isModelInLibrary(modelId: string | null, savedModels: SavedModel[]): boolean {
  return Boolean(modelId && savedModels.some((m) => m.id === modelId))
}
