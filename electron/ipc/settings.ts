/**
 * IPC handlers for API-key management and the user's model library.
 *
 * The key flow is the security-sensitive part:
 *   • validateKey — checks a key against OpenRouter WITHOUT saving it
 *   • saveKey     — validates, then (only if valid) encrypts + stores it
 *   • getBalance  — re-checks the stored key (for the settings screen)
 * The decrypted key is read here and handed straight to the OpenRouter
 * client; it is never returned to the renderer.
 */
import { ipcMain } from 'electron'
import {
  CHANNELS,
  type AddSavedModelResult,
  type KeyStatus,
  type KeyValidationResult,
  type ModelValidationResult
} from '@shared/api-contract'
import { validateKey as validateAgainstOpenRouter, validateModel as validateModelOnOpenRouter } from '../services/openrouter'
import * as secureStore from '../services/secure-store'
import * as settingsStore from '../services/settings-store'

/** Validate a key and shape the result for the UI (never throws). */
async function validate(key: string): Promise<KeyValidationResult> {
  try {
    const balance = await validateAgainstOpenRouter(key)
    return { ok: true, balance }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Validation failed.' }
  }
}

/** Validate a model id using the stored API key (never throws). */
async function validateModel(modelId: string): Promise<ModelValidationResult> {
  const key = secureStore.getKey()
  if (!key) return { ok: false, error: 'No API key stored.' }
  return validateModelOnOpenRouter(key, modelId)
}

export function registerSettingsHandlers(): void {
  ipcMain.handle(CHANNELS.settings.getKeyStatus, (): KeyStatus => ({ hasKey: secureStore.hasKey() }))

  ipcMain.handle(CHANNELS.settings.validateKey, (_e, key: string) => validate(key))

  ipcMain.handle(CHANNELS.settings.saveKey, async (_e, key: string) => {
    const result = await validate(key)
    if (result.ok) {
      secureStore.setKey(key) // only persist a key we know works
      settingsStore.markOnboardingPending()
    }
    return result
  })

  ipcMain.handle(CHANNELS.settings.clearKey, () => {
    secureStore.clearKey()
    settingsStore.resetOnboarding()
  })

  ipcMain.handle(CHANNELS.settings.getBalance, async (): Promise<KeyValidationResult> => {
    const key = secureStore.getKey()
    if (!key) return { ok: false, error: 'No API key stored.' }
    return validate(key)
  })

  ipcMain.handle(CHANNELS.settings.getSavedModels, () => settingsStore.getSavedModels())
  ipcMain.handle(CHANNELS.settings.setSavedModels, (_e, modelIds: string[]) => settingsStore.setSavedModels(modelIds))
  ipcMain.handle(CHANNELS.settings.removeSavedModel, (_e, modelId: string) =>
    settingsStore.removeSavedModel(modelId)
  )

  ipcMain.handle(CHANNELS.settings.addSavedModel, async (_e, modelId: string): Promise<AddSavedModelResult> => {
    const id = modelId.trim()
    const existing = settingsStore.getSavedModels()
    if (existing.includes(id)) {
      return { ok: false, models: existing, error: 'This model is already in your library.' }
    }

    const validation = await validateModel(id)
    if (!validation.ok) return { ok: false, models: existing, error: validation.error }

    const models = settingsStore.addSavedModel(id)
    return { ok: true, models }
  })

  ipcMain.handle(CHANNELS.settings.validateModel, (_e, modelId: string) => validateModel(modelId))

  ipcMain.handle(CHANNELS.settings.isOnboardingCompleted, () => settingsStore.isOnboardingCompleted())
  ipcMain.handle(CHANNELS.settings.completeOnboarding, () => settingsStore.completeOnboarding())
}
