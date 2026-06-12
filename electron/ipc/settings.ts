/**
 * IPC handlers for API-key management and the user's custom model list.
 *
 * The key flow is the security-sensitive part:
 *   • validateKey — checks a key against OpenRouter WITHOUT saving it
 *   • saveKey     — validates, then (only if valid) encrypts + stores it
 *   • getBalance  — re-checks the stored key (for the settings screen)
 * The decrypted key is read here and handed straight to the OpenRouter
 * client; it is never returned to the renderer.
 */
import { ipcMain } from 'electron'
import { CHANNELS, type KeyStatus, type KeyValidationResult } from '@shared/api-contract'
import { validateKey as validateAgainstOpenRouter } from '../services/openrouter'
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

export function registerSettingsHandlers(): void {
  ipcMain.handle(CHANNELS.settings.getKeyStatus, (): KeyStatus => ({ hasKey: secureStore.hasKey() }))

  ipcMain.handle(CHANNELS.settings.validateKey, (_e, key: string) => validate(key))

  ipcMain.handle(CHANNELS.settings.saveKey, async (_e, key: string) => {
    const result = await validate(key)
    if (result.ok) secureStore.setKey(key) // only persist a key we know works
    return result
  })

  ipcMain.handle(CHANNELS.settings.clearKey, () => secureStore.clearKey())

  ipcMain.handle(CHANNELS.settings.getBalance, async (): Promise<KeyValidationResult> => {
    const key = secureStore.getKey()
    if (!key) return { ok: false, error: 'No API key stored.' }
    return validate(key)
  })

  ipcMain.handle(CHANNELS.settings.getCustomModels, () => settingsStore.getCustomModels())
  ipcMain.handle(CHANNELS.settings.addCustomModel, (_e, modelId: string) => settingsStore.addCustomModel(modelId))
  ipcMain.handle(CHANNELS.settings.removeCustomModel, (_e, modelId: string) =>
    settingsStore.removeCustomModel(modelId)
  )
}
