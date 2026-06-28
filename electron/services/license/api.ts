/**
 * HTTP client for the Arco license activation endpoint.
 *
 * Activation is the only server call for licensing; launch status is read from
 * encrypted local storage (license.bin). The renderer never calls the server directly.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import type { LicenseType } from '@shared/api-contract'
import { getApiBaseUrl } from '../../config/env'

/**
 * Response shape for POST /api/licenses/activate.
 *
 * This mirrors the backend route's response shape by convention only — there
 * is no shared type-checking between the two repos, so keep this in sync
 * with arco-web's app/api/licenses/activate/route.ts if either side changes.
 */
export interface LicenseApiResponse {
  isActivated: boolean
  expiresAt: string | null
  /** Present on success; null on failure (no license context). */
  type: LicenseType | null
  message: string
}

interface LicensePostResult {
  response: Response
  body: LicenseApiResponse | null
}

/** Parse a license API response body; returns null if not JSON. */
async function parseLicenseResponse(response: Response): Promise<LicenseApiResponse | null> {
  const raw = await response.text()
  if (!raw.trim()) return null
  try {
    return JSON.parse(raw) as LicenseApiResponse
  } catch {
    return null
  }
}

/** Activate a license key for this device. */
export async function activateLicenseOnServer(key: string, deviceId: string): Promise<LicensePostResult> {
  const baseUrl = getApiBaseUrl()
  if (!baseUrl) {
    throw new Error('License API is not configured for this build.')
  }

  const response = await fetch(`${baseUrl}/api/licenses/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, deviceId })
  })

  const body = await parseLicenseResponse(response)
  return { response, body }
}

/** User-facing message from a license API response. */
export function licenseApiMessage(
  body: LicenseApiResponse | null,
  responseOk: boolean,
  status: number,
  activatedFallback = 'License activated successfully.',
  failedFallback = 'Unable to activate license.'
): string {
  if (body && typeof body.message === 'string' && body.message.length > 0) {
    return body.message
  }
  if (responseOk && body?.isActivated) {
    return activatedFallback
  }
  if (!responseOk) {
    return `License server error (${status}). Please try again later.`
  }
  return failedFallback
}
