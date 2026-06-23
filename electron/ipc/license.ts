/**
 * IPC handlers for Pro license activation and status.
 *
 * Flow:
 *   • getStatus   — read encrypted license.bin (local only, no server call)
 *   • activate    — POST { key, deviceId } to /api/licenses/activate
 *   • getDeviceId — node-machine-id hardware fingerprint
 *   • getCheckoutUrl — environment-specific Creem payment link
 *
 * The renderer never calls the license server directly except via activate.
 */
import {
  CHANNELS,
  type LicenseActivationResult,
  type LicenseStatus
} from '@shared/api-contract'
import { ipcMain } from 'electron'
import { machineIdSync } from 'node-machine-id'
import { activateLicenseOnServer, licenseApiMessage } from '../services/license/api'
import { getCheckoutUrl, getLicenseApiBaseUrl } from '../services/license/config'
import * as licenseStore from '../services/store/license-store'

function getDeviceId(): string {
  return machineIdSync()
}

export function registerLicenseHandlers(): void {
  ipcMain.handle(CHANNELS.license.getStatus, (): LicenseStatus => {
    const stored = licenseStore.readLicense()
    if (!stored) return { isActivated: false }
    return { isActivated: true, key: stored.key }
  })

  ipcMain.handle(CHANNELS.license.getDeviceId, (): string => getDeviceId())

  ipcMain.handle(CHANNELS.license.getCheckoutUrl, (): string | null => getCheckoutUrl())

  ipcMain.handle(
    CHANNELS.license.activate,
    async (_e, key: string): Promise<LicenseActivationResult> => {
      const trimmed = key.trim()
      if (!trimmed) {
        return {
          ok: false,
          message: 'Please enter a license key.'
        }
      }

      if (!getLicenseApiBaseUrl()) {
        return {
          ok: false,
          message: 'License activation is not configured for this build yet.'
        }
      }

      const deviceId = getDeviceId()

      try {
        const { response, body } = await activateLicenseOnServer(trimmed, deviceId)

        if (!body) {
          return {
            ok: false,
            message: response.ok
              ? 'Invalid response from license server. Please try again later.'
              : licenseApiMessage(null, false, response.status)
          }
        }

        const message = licenseApiMessage(body, response.ok, response.status)

        if (!response.ok) {
          return { ok: false, message }
        }

        if (body.isActivated) {
          licenseStore.writeLicense({
            key: trimmed,
            activatedAt: new Date().toISOString(),
            deviceId
          })
          return { ok: true, message }
        }

        return { ok: false, message }
      } catch (err) {
        const fallback =
          err instanceof Error ? err.message : 'Network error. Please check your connection.'
        return {
          ok: false,
          message: `Could not reach the license server. ${fallback}`
        }
      }
    }
  )
}
