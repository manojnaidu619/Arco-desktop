/**
 * The curated list of models shown as quick-pick checkboxes in the UI.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ HOW TO ADD / CHANGE THE DEFAULT MODELS                                │
 * │ Edit the CURATED_MODELS array below. Each `openRouterModelId` must be │
 * │ a valid OpenRouter model ID (the exact string from openrouter.ai/     │
 * │ models, e.g. "openai/gpt-4o" or "anthropic/claude-3.5-sonnet").      │
 * │                                                                       │
 * │ Users can ALSO paste any model ID at runtime via the "Add model"      │
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
  /** OpenRouter model ID, e.g. "openai/gpt-4o" or "anthropic/claude-opus-4.8". */
  openRouterModelId: string
  /** Friendly display name, e.g. "GPT-4o" or "Claude Opus 4.8". */
  label: string
  /** OpenRouter author (provider), e.g. "openai" or "anthropic". */
  author: string
  /** Hex color for the model's colored dot/badge, e.g. "#f43f5e". */
  color: string
}

export const CURATED_MODELS: ModelDef[] = [
  { openRouterModelId: 'deepseek/deepseek-v4-flash', label: 'DeepSeek V4 Flash', author: 'DeepSeek', color: '#06b6d4' },
  { openRouterModelId: 'moonshotai/kimi-k2-thinking', label: 'Kimi K2 Thinking', author: 'Moonshot AI', color: '#8b5cf6' },
  { openRouterModelId: 'z-ai/glm-4.7-flash', label: 'GLM-4.7 Flash', author: 'Zhipu AI', color: '#3b82f6' },
  { openRouterModelId: 'minimax/minimax-m2.7', label: 'MiniMax M2.7', author: 'MiniMax', color: '#f43f5e' },
  { openRouterModelId: 'qwen/qwen3.6-flash', label: 'Qwen 3.6 Flash', author: 'Alibaba', color: '#f97316' },
  { openRouterModelId: 'anthropic/claude-opus-4.8', label: 'Claude Opus 4.8', author: 'Anthropic', color: '#f59e0b' }
]

/** Minimum models required during onboarding before the user can continue. */
export const ONBOARDING_MIN_MODELS = 4

/** Curated models offered as the default seed list during onboarding (first six). */
export const ONBOARDING_SUGGESTED_MODELS = CURATED_MODELS.slice(0, 6)

/** Generate a random hex color for custom model defaults. */
export function randomHexColor(): string {
  return `#${Math.floor(Math.random() * 0xffffff)
    .toString(16)
    .padStart(6, '0')}`
}

/**
 * Hex color from the curated list, or the default fallback.
 *
 * @param openRouterModelId - OpenRouter model ID, e.g. "openai/gpt-4o"
 */
export function getCuratedColorByOpenRouterId(openRouterModelId: string): string {
  return CURATED_MODELS.find((m) => m.openRouterModelId === openRouterModelId)?.color ?? DEFAULT_MODEL_COLOR
}

/**
 * Resolve an OpenRouter model ID to its display metadata.
 *
 * Falls back to a sensible derived label/author for IDs that aren't in the
 * curated list (e.g. a custom ID the user pasted). This means the UI can
 * render ANY OpenRouter model ID gracefully.
 *
 * @param openRouterModelId - OpenRouter model ID, e.g. "openai/gpt-4o"
 *
 * @example
 *   getModelDef('openai/gpt-4o')
 *   // → { openRouterModelId: 'openai/gpt-4o', label: 'gpt-4o', author: 'openai', color: '#64748b' }
 */
export function getModelDef(openRouterModelId: string): ModelDef {
  return (
    CURATED_MODELS.find((m) => m.openRouterModelId === openRouterModelId) ?? {
      openRouterModelId,
      label: openRouterModelId.split('/').pop() ?? openRouterModelId,
      author: openRouterModelId.split('/')[0] ?? 'Unknown',
      color: DEFAULT_MODEL_COLOR
    }
  )
}

/**
 * Prefer persisted color from the library; fall back to curated/default.
 *
 * @param openRouterModelId - OpenRouter model ID, e.g. "openai/gpt-4o"
 */
export function resolveModelColor(openRouterModelId: string, savedModels?: SavedModel[]): string {
  const saved = savedModels?.find((m) => m.openRouterModelId === openRouterModelId)
  if (saved?.color) return saved.color
  return getCuratedColorByOpenRouterId(openRouterModelId)
}

/**
 * Parse an OpenRouter model ID into its component parts.
 *
 * @param openRouterModelId - OpenRouter model ID, e.g. "openai/gpt-4o"
 * @returns Object with author (e.g. "openai") and slug (e.g. "gpt-4o"), or null if invalid
 *
 * @example
 *   parseOpenRouterModelId("anthropic/claude-opus-4.8")
 *   // → { author: "anthropic", slug: "claude-opus-4.8" }
 */
export function parseOpenRouterModelId(openRouterModelId: string): { author: string; slug: string } | null {
  const slash = openRouterModelId.indexOf('/')
  if (slash === -1) return null
  const author = openRouterModelId.slice(0, slash).trim()
  const slug = openRouterModelId.slice(slash + 1).trim()
  if (!author || !slug) return null
  return { author, slug }
}

/**
 * Compose an OpenRouter model ID from author + slug.
 *
 * @param author - OpenRouter provider, e.g. "openai"
 * @param slug - Model name, e.g. "gpt-4o"
 * @returns Full OpenRouter model ID, e.g. "openai/gpt-4o"
 */
export function formatOpenRouterModelId(author: string, slug: string): string {
  return `${author}/${slug}`
}

/**
 * True when the OpenRouter model ID is in the user's saved library.
 *
 * @param openRouterModelId - OpenRouter model ID, e.g. "openai/gpt-4o", or null for an empty pane
 */
export function isModelInLibrary(openRouterModelId: string | null, savedModels: SavedModel[]): boolean {
  return Boolean(openRouterModelId && savedModels.some((m) => m.openRouterModelId === openRouterModelId))
}
