/**
 * Convenience accessor for the backend bridge.
 *
 * Instead of reaching for the global `window.api` everywhere, components and
 * hooks import this typed `api` object. It's the renderer's single doorway to
 * the main process — sessions, chat, and settings all flow through here.
 */
import type { ArcoApi } from '@shared/api-contract'

export const api: ArcoApi = window.api
