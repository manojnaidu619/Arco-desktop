/**
 * Non-secret user preferences, stored as plain JSON in the app data folder
 * (~/Library/Application Support/Multi-Mind/settings.json).
 *
 * Holds onboarding state only. The saved model library lives in SQLite.
 *
 * (Secrets like the API key do NOT go here — see secure-store.ts.)
 */
import { app } from 'electron'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

interface Settings {
  onboardingCompleted: boolean
}

const DEFAULTS: Settings = {
  onboardingCompleted: false
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

/** Read settings from disk, falling back to defaults for missing fields. */
function read(): Settings {
  const path = settingsPath()
  if (!existsSync(path)) return { ...DEFAULTS }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<Settings>
    return {
      onboardingCompleted: parsed.onboardingCompleted ?? DEFAULTS.onboardingCompleted
    }
  } catch {
    return { ...DEFAULTS }
  }
}

/** Write settings back to disk (pretty-printed for easy inspection). */
function write(settings: Settings): void {
  writeFileSync(settingsPath(), JSON.stringify(settings, null, 2))
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
