/**
 * Runtime environment configuration for the Electron main process.
 *
 * Use this module when behavior must differ between dev (`npm run dev`) and
 * packaged production builds. Static values live in @shared/config; this file
 * composes them with Electron APIs.
 *
 * Usage (main process only):
 *   import { isDev, getApiBaseUrl, getCheckoutUrl } from './config/env'
 */

import { app } from 'electron'
import { API_BASE_URL_DEV, ARCO_WEBSITE_URL, PRICING_PATH } from '@shared/config'

export function isDev(): boolean {
  return !app.isPackaged
}

/** Base URL for Arco backend API (no trailing slash). */
export function getApiBaseUrl(): string | null {
  return isDev() ? API_BASE_URL_DEV : ARCO_WEBSITE_URL
}

export function getCheckoutUrl(): string | null {
  const base = getApiBaseUrl()
  return base ? `${base}${PRICING_PATH}` : null
}
