// @see STANDARDS.md for coding standards and conventions of this codebase
/// <reference types="vite/client" />

// Tell TypeScript about the `window.api` object that the preload bridge
// publishes (see electron/preload.ts). This is what makes `api.sessions.…`
// fully typed in the UI.
import type { ArcoApi } from '@shared/api-contract'

declare global {
  interface Window {
    api: ArcoApi
  }
}

interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY: string
  readonly VITE_POSTHOG_HOST: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

export {}
