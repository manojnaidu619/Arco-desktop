/**
 * Non-secret user preferences, stored as plain JSON in the app data folder
 * (~/Library/Application Support/Multi-Mind/settings.json).
 *
 * Right now this just holds the user's custom (non-curated) model ids so they
 * persist across restarts and appear in the model picker. It's intentionally
 * tiny and easy to extend: add a field to `Settings`, a default in
 * `DEFAULTS`, and a getter/setter.
 *
 * (Secrets like the API key do NOT go here — see secure-store.ts.)
 */
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface Settings {
  /** OpenRouter model ids the user pasted via "Add model". */
  customModels: string[]
}

const DEFAULTS: Settings = {
  customModels: []
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** Read settings from disk, falling back to defaults for missing fields. */
function read(): Settings {
  const path = settingsPath()
  if (!existsSync(path)) return { ...DEFAULTS }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8'))
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

/** Write settings back to disk (pretty-printed for easy inspection). */
function write(settings: Settings): void {
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
}

/** Get the user's saved custom model ids. */
export function getCustomModels(): string[] {
  return read().customModels
}

/** Add a custom model id (no-op if already present). Returns the new list. */
export function addCustomModel(modelId: string): string[] {
  const id = modelId.trim()
  const settings = read()
  if (id && !settings.customModels.includes(id)) {
    settings.customModels.push(id)
    write(settings)
  }
  return settings.customModels
}

/** Remove a custom model id. Returns the new list. */
export function removeCustomModel(modelId: string): string[] {
  const settings = read()
  settings.customModels = settings.customModels.filter((m) => m !== modelId)
  write(settings)
  return settings.customModels
}
