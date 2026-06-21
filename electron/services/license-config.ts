/**
 * Environment-aware URLs for license checkout and activation API.
 *
 * Dev uses local/test endpoints; production URLs are placeholders until
 * configured. Detection mirrors main.ts: `!app.isPackaged` means dev.
 */
import { app } from 'electron'

/** Creem test checkout for Unlimited (development / unpackaged builds). */
const CHECKOUT_URL_DEV =
  'https://www.creem.io/test/payment/prod_6FOGXk6mKLjdVuAdBDnKrA'

/** Production checkout — Creem live payment link for Unlimited. */
// TODO: Provision production checkout URL (live Creem product link) before release.
const CHECKOUT_URL_PROD: string | null = null

/** Local license server during development. */
const API_BASE_URL_DEV = 'http://localhost:3000'

/** Production license API base — set when the live server URL is ready. */
const API_BASE_URL_PROD: string | null = 'https://arco.chat'

function isDev(): boolean {
  return !app.isPackaged
}

/** URL opened when the user clicks "Purchase" in the upgrade modal. */
export function getCheckoutUrl(): string | null {
  return isDev() ? CHECKOUT_URL_DEV : CHECKOUT_URL_PROD
}

/** Base URL for license API calls (no trailing slash). */
export function getLicenseApiBaseUrl(): string | null {
  return isDev() ? API_BASE_URL_DEV : API_BASE_URL_PROD
}
