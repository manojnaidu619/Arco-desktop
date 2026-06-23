/**
 * Runtime environment configuration for the Electron main process.
 *
 * Use this module when behavior must differ between dev (`npm run dev`) and
 * packaged production builds. Static values live in @shared/config; this file
 * composes them with Electron APIs.
 *
 * Usage (main process only):
 *   import { isDev, getApiBaseUrl, getCheckoutUrl } from './config/env'
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */

import { app } from 'electron'
import { API_BASE_URL_DEV, ARCO_WEBSITE_URL, PRICING_PATH } from '@shared/config'

/**
 * Check if the app is running in development mode.
 *
 * @used-by main.ts, DevTools configuration, CSP application
 * @returns true when running via `npm run dev`, false in packaged builds
 */
export function isDev(): boolean {
  return !app.isPackaged
}

/**
 * Get the base URL for the Arco backend API.
 *
 * In dev mode, points to the local development server. In production,
 * points to the Arco website. Returns null if neither is configured.
 *
 * @used-by license/api.ts for license validation requests
 * @returns base URL without trailing slash, or null if not configured
 */
export function getApiBaseUrl(): string | null {
  return isDev() ? API_BASE_URL_DEV : ARCO_WEBSITE_URL
}

/**
 * Get the URL for the Pro plan checkout/pricing page.
 *
 * Constructs the full URL by combining the API base with the pricing path.
 * Returns null if the API base is not configured.
 *
 * @used-by license IPC handler for opening the purchase page
 * @returns full checkout URL, or null if API base is not configured
 */
export function getCheckoutUrl(): string | null {
  const base = getApiBaseUrl()
  return base ? `${base}${PRICING_PATH}` : null
}
