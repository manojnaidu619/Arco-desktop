/**
 * Non-secret user preferences, stored as plain JSON in the app data folder
 * (~/Library/Application Support/Multi-Mind/settings.json).
 *
 * Holds the user's saved model library (OpenRouter ids) and onboarding state.
 *
 * (Secrets like the API key do NOT go here — see secure-store.ts.)
 */
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** A model in the user's library with its add timestamp for sorting. */
interface SavedModelEntry {
  id: string
  addedAt: number
}

interface Settings {
  savedModels: SavedModelEntry[]
  onboardingCompleted: boolean
}

const DEFAULTS: Settings = {
  savedModels: [],
  onboardingCompleted: false
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** Normalize legacy string[] entries into timestamped objects. */
function normalizeSavedModels(raw: unknown): SavedModelEntry[] {
  if (!Array.isArray(raw)) return []

  const base = Date.now()
  return raw
    .map((item, index): SavedModelEntry | null => {
      if (typeof item === 'string') {
        return { id: item.trim(), addedAt: base + index }
      }
      if (item && typeof item === 'object' && 'id' in item && typeof item.id === 'string') {
        const addedAt =
          'addedAt' in item && typeof item.addedAt === 'number' ? item.addedAt : base + index
        return { id: item.id.trim(), addedAt }
      }
      return null
    })
    .filter((entry): entry is SavedModelEntry => Boolean(entry?.id))
}

/** Newest additions first. */
function sortNewestFirst(entries: SavedModelEntry[]): SavedModelEntry[] {
  return entries.slice().sort((a, b) => b.addedAt - a.addedAt)
}

/**
 * Read settings from disk, falling back to defaults for missing fields.
 * Runs one-time migrations for installs that predate savedModels.
 */
function read(): Settings {
  const path = settingsPath()
  const isExistingInstall = existsSync(path)
  if (!isExistingInstall) return { ...DEFAULTS }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<Settings> & {
      savedModels?: unknown
    }
    const savedModels = normalizeSavedModels(parsed.savedModels)
    const settings: Settings = {
      savedModels,
      onboardingCompleted: parsed.onboardingCompleted ?? DEFAULTS.onboardingCompleted
    }

    return settings
  } catch {
    return { ...DEFAULTS }
  }
}

/** Write settings back to disk (pretty-printed for easy inspection). */
function write(settings: Settings): void {
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
}

/** Get the user's saved model library, newest first. */
export function getSavedModels(): string[] {
  return sortNewestFirst(read().savedModels).map((m) => m.id)
}

/** Replace the entire saved model library. Returns the persisted list (newest first). */
export function setSavedModels(models: string[]): string[] {
  const settings = read()
  const ids = [...new Set(models.map((m) => m.trim()).filter(Boolean))]
  const now = Date.now()
  settings.savedModels = ids.map((id, index) => ({ id, addedAt: now + index }))
  write(settings)
  return getSavedModels()
}

/** Add a model id to the library (no-op if already present). Returns the new list (newest first). */
export function addSavedModel(modelId: string): string[] {
  const id = modelId.trim()
  const settings = read()
  if (id && !settings.savedModels.some((m) => m.id === id)) {
    settings.savedModels.push({ id, addedAt: Date.now() })
    write(settings)
  }
  return getSavedModels()
}

/** Remove a model id from the library. Returns the new list (newest first). */
export function removeSavedModel(modelId: string): string[] {
  const settings = read()
  settings.savedModels = settings.savedModels.filter((m) => m.id !== modelId)
  write(settings)
  return getSavedModels()
}

/** Whether the user completed the model-selection onboarding step. */
export function isOnboardingCompleted(): boolean {
  return read().onboardingCompleted
}

/** Mark onboarding as complete after the user selects their starter models. */
export function completeOnboarding(): void {
  const settings = read()
  settings.onboardingCompleted = true
  write(settings)
}

/** Reset onboarding progress when the API key is removed. */
export function resetOnboarding(): void {
  const settings = read()
  settings.onboardingCompleted = false
  settings.savedModels = []
  write(settings)
}

/**
 * Persist that model selection is still pending after a key is saved.
 * Creates/updates settings.json with `onboardingCompleted: false` so a
 * relaunch resumes at the model-selection step instead of skipping ahead.
 */
export function markOnboardingPending(): void {
  const settings = read()
  if (settings.onboardingCompleted) return
  settings.onboardingCompleted = false
  write(settings)
}
