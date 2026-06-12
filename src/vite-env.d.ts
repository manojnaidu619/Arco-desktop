/// <reference types="vite/client" />

// Tell TypeScript about the `window.api` object that the preload bridge
// publishes (see electron/preload.ts). This is what makes `api.sessions.…`
// fully typed in the UI.
import type { MultiMindApi } from '@shared/api-contract'

declare global {
  interface Window {
    api: MultiMindApi
  }
}

export {}
