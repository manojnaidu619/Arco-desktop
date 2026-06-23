/**
 * Global static configuration shared across main process, preload, and renderer.
 *
 * Put constants here that are the same in every environment and do not require
 * Electron or Node APIs. For dev vs production behavior, use electron/config/env.ts
 * in the main process instead.
 *
 * Usage:
 *   import { PRODUCT_NAME, ARCO_WEBSITE_URL } from '@shared/config'
 */

/** Product display name (menus, OpenRouter headers, app.setName). */
export const PRODUCT_NAME = 'Arco'

/** Public marketing / API site (no trailing slash). */
export const ARCO_WEBSITE_URL = 'https://arco.chat'

/** Local Arco backend during development. */
export const API_BASE_URL_DEV = 'http://localhost:3000'

/** Website path for desktop Pro upgrade. */
export const PRICING_PATH = '/pricing'
