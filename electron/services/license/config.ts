/**
 * Environment-aware URLs for license pricing page and activation API.
 *
 * Dev uses local endpoints; production uses arco.chat.
 * Detection mirrors main.ts: `!app.isPackaged` means dev.
 */
import { app } from 'electron'

/** Local license server during development. */
const API_BASE_URL_DEV = 'http://localhost:3000'

/** Production license API base. */
const API_BASE_URL_PROD: string | null = 'https://arco.chat'

/** Path on the Arco website for desktop users upgrading to Pro. */
const PRICING_PATH = '/pricing'

function isDev(): boolean {
  return !app.isPackaged
}

/** URL opened when the user clicks "Unlock Pro" in the upgrade modal. */
export function getCheckoutUrl(): string | null {
  const base = getLicenseApiBaseUrl()
  return base ? `${base}${PRICING_PATH}` : null
}

/** Base URL for license API calls (no trailing slash). */
export function getLicenseApiBaseUrl(): string | null {
  return isDev() ? API_BASE_URL_DEV : API_BASE_URL_PROD
}
