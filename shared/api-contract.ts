/**
 * THE BRIDGE CONTRACT — the single source of truth for how the UI talks to
 * the backend.
 *
 * In a normal web app the frontend calls the backend with `fetch('/api/…')`.
 * In this desktop app there is no web server: the React UI (renderer) and the
 * Node backend (main process) run as two separate processes on the user's Mac
 * and talk over Electron's IPC ("inter-process communication") channel.
 *
 * To keep that safe and tidy we expose ONE typed object — `window.api` — to
 * the UI. The UI may call only the methods defined here; it can't reach the
 * filesystem, the database, or the user's API key directly.
 *
 * Three files implement this one contract, and they must always agree:
 *   • shared/api-contract.ts (this file) — the types + channel names
 *   • electron/preload.ts                — wires `window.api` to IPC
 *   • electron/ipc/*.ts                  — the backend handlers
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */

import type { Message, Role, SavedModel, SessionData, SessionSummary, UrlCitation } from './types'

/* ── Chat streaming payloads ──────────────────────────────────────────────
 * Chat is special: instead of one request → one response, the answer streams
 * back token-by-token. So the UI STARTS a request (fire-and-forget) and then
 * LISTENS for a series of "delta" events, ending in "done" or "error". Each
 * request carries a `requestId` so the UI can tell concurrent streams apart.
 */
export interface ChatStartRequest {
  /** Unique id the UI generates to correlate the stream's events. */
  requestId: string
  /** OpenRouter model ID to query, e.g. "openai/gpt-4o" or "anthropic/claude-opus-4.8". */
  openRouterModelId: string
  /** Full conversation so far (the last item is the new user turn). */
  messages: Message[]
  /** When true, enable OpenRouter's openrouter:web_search server tool. */
  webSearch?: boolean
}

/** Emitted repeatedly as new text arrives from the model. */
export interface ChatDeltaEvent {
  requestId: string
  delta: string
}

/** Emitted once when a stream finishes successfully. */
export interface ChatDoneEvent {
  requestId: string
  /** The complete assembled response (handy for persisting). */
  content: string
  /** Web search source citations, when the model used web search. */
  annotations?: UrlCitation[]
}

/** Emitted once if a stream fails. */
export interface ChatErrorEvent {
  requestId: string
  message: string
}

/**
 * Payload to start a summary request.
 * Contains the user's question and all model responses to compare.
 */
export interface SummaryStartRequest {
  /** Unique id to correlate streaming events. */
  requestId: string
  /** OpenRouter model ID for summarization, e.g. "openai/gpt-4o". */
  openRouterModelId: string
  /** The user's original question being summarized. */
  userMessage: string
  /** Responses from each model pane to compare. */
  responses: Array<{ modelLabel: string; content: string }>
}

/* ── Settings / API-key payloads ─────────────────────────────────────────── */

/** Remaining-credit info pulled from OpenRouter, shown during onboarding. */
export interface BalanceInfo {
  /** Total credits purchased, or null if the account has no hard limit. */
  totalCredits: number | null
  /** Credits used so far. */
  totalUsage: number
  /** Credits remaining (totalCredits - totalUsage), or null if unlimited. */
  remaining: number | null
  /** Human label OpenRouter associates with the key, if any. */
  label?: string
  /** Whether the key is on OpenRouter's free tier. */
  isFreeTier?: boolean
}

/** Result of validating (and optionally saving) an API key. */
export interface KeyValidationResult {
  ok: boolean
  /** Present when `ok` is false — a human-readable reason. */
  error?: string
  /** Present when `ok` is true — the account's credit balance. */
  balance?: BalanceInfo
}

/** Whether a key is currently stored. Drives the onboarding gate. */
export interface KeyStatus {
  hasKey: boolean
}

/** Result of validating an OpenRouter model id against the catalog. */
export interface ModelValidationResult {
  ok: boolean
  error?: string
  modelName?: string
}

/** Result of adding a model to the user's saved library. */
export interface AddSavedModelResult {
  ok: boolean
  models: SavedModel[]
  error?: string
}

/* ── License payloads (Pro or Unlimited) ──────────────────────────────────── */

/** License tier. Both tiers grant identical app features — duration differs (see license-store.ts). */
export type LicenseType = 'pro' | 'unlimited'

/** Whether a license (Pro or Unlimited) is active on this device. */
export interface LicenseStatus {
  isActivated: boolean
  /** Present when activated — the stored license key (masked is not required for phase 1). */
  key?: string
  /** Present when activated. Absent license.bin from before this field shipped is normalized to 'pro' by license-store.ts. */
  type?: LicenseType
}

/**
 * Result of attempting to activate a license key.
 * The `message` field always comes from the license server and must be shown
 * to the user — success or failure.
 */
export interface LicenseActivationResult {
  ok: boolean
  message: string
  /** Present when ok is true — the tier just activated. */
  type?: LicenseType
}

/** Result of creating a new session. */
export interface SessionCreateResult {
  ok: boolean
  sessionId?: number
  /** Present when `ok` is false — a human-readable reason. */
  error?: string
  /** Free-tier cap hit; UI may show the upgrade modal. */
  code?: 'session_limit'
}

/* ── Auto-update payloads ────────────────────────────────────────────────── */

/** Metadata about an available or downloaded update. */
export interface UpdateInfoPayload {
  version: string
  releaseDate?: string
  releaseNotes?: string
}

/** Per-chunk progress while downloading the update zip. */
export interface UpdateProgressPayload {
  percent: number
  bytesPerSecond: number
  transferred: number
  total: number
}

/** Emitted when the updater hits an error. */
export interface UpdateErrorPayload {
  message: string
}

/**
 * The complete `window.api` surface available to the UI.
 *
 * Grouped by domain (sessions / chat / settings) to mirror the backend
 * handler files. Adding a feature = add a method here, implement it in the
 * matching electron/ipc file, and wire it in preload.ts.
 */
export interface ArcoApi {
  /** Conversation history persistence (SQLite-backed). */
  sessions: {
    /** Get the active session (creating one if none exists). */
    getCurrent(): Promise<SessionData>
    /** List all sessions for the sidebar, newest first. */
    list(): Promise<SessionSummary[]>
    /** Whether the user may create another saved conversation. */
    canCreate(): Promise<boolean>
    /** Create a fresh session and make it active. */
    create(): Promise<SessionCreateResult>
    /** Switch the active session and return its full data. */
    load(sessionId: number): Promise<SessionData>
    /** Permanently delete a session (threads + messages cascade). */
    delete(sessionId: number): Promise<void>
    /** Set a session's title (used for the sidebar label). */
    setTitle(sessionId: number, title: string): Promise<void>
    /** Set a session's grid layout (visible pane count: 1|2|3|4|6). */
    setLayout(sessionId: number, layout: number): Promise<void>
    /** Add a pane (thread) at a grid slot. Returns the new thread's id. */
    addThread(sessionId: number, slot: number, openRouterModelId: string, label: string): Promise<number>
    /** Change a pane's model and CLEAR its messages (fresh conversation). */
    updateThreadModel(threadId: number, openRouterModelId: string, label: string): Promise<void>
    /** Remove a model thread (messages cascade). */
    deleteThread(threadId: number): Promise<void>
    /** Re-slot threads to a new grid order (threadIds in the desired order). */
    reorderThreads(threadIds: number[]): Promise<void>
    /** Append a message to a thread. */
    addMessage(threadId: number, role: Role, content: string): Promise<void>
  }

  /** Streaming chat with OpenRouter. */
  chat: {
    /** Begin streaming a response. Listen via onDelta/onDone/onError. */
    start(req: ChatStartRequest): void
    /** Cancel an in-flight stream by its requestId. */
    abort(requestId: string): void
    /** Subscribe to streamed text. Returns an unsubscribe function. */
    onDelta(cb: (event: ChatDeltaEvent) => void): () => void
    /** Subscribe to stream-complete events. Returns an unsubscribe function. */
    onDone(cb: (event: ChatDoneEvent) => void): () => void
    /** Subscribe to stream-error events. Returns an unsubscribe function. */
    onError(cb: (event: ChatErrorEvent) => void): () => void
  }

  /** Multi-model response summarization via OpenRouter. */
  summary: {
    /** Begin streaming a summary. Listen via onDelta/onDone/onError. */
    start(req: SummaryStartRequest): void
    /** Cancel an in-flight summary by its requestId. */
    abort(requestId: string): void
    /** Subscribe to streamed summary text. Returns an unsubscribe function. */
    onDelta(cb: (event: ChatDeltaEvent) => void): () => void
    /** Subscribe to summary-complete events. Returns an unsubscribe function. */
    onDone(cb: (event: ChatDoneEvent) => void): () => void
    /** Subscribe to summary-error events. Returns an unsubscribe function. */
    onError(cb: (event: ChatErrorEvent) => void): () => void
  }

  /** API key management + the user's saved model library. */
  settings: {
    /** Whether an API key is stored (drives the first-run gate). */
    getKeyStatus(): Promise<KeyStatus>
    /** Validate a key WITHOUT saving it (used while typing/onboarding). */
    validateKey(key: string): Promise<KeyValidationResult>
    /** Validate a key and, if valid, store it encrypted in the Keychain. */
    saveKey(key: string): Promise<KeyValidationResult>
    /** Delete the stored key (returns the app to the onboarding gate). */
    clearKey(): Promise<void>
    /** Re-fetch the current key's balance (for the settings screen). */
    getBalance(): Promise<KeyValidationResult>
    /** Get the user's saved model library (used in dropdowns and default panes). */
    getSavedModels(): Promise<SavedModel[]>
    /** Replace the entire saved model library. Returns the persisted list. */
    setSavedModels(models: SavedModel[]): Promise<SavedModel[]>
    /** Validate and add an OpenRouter model ID; returns updated list on success. */
    addSavedModel(openRouterModelId: string, color: string): Promise<AddSavedModelResult>
    /** Remove a model from the saved library. Returns the updated list. */
    removeSavedModel(openRouterModelId: string): Promise<SavedModel[]>
    /** Validate an OpenRouter model ID without saving it (used during onboarding). */
    validateModel(openRouterModelId: string): Promise<ModelValidationResult>
    /** Whether the user finished the model-selection onboarding step. */
    isOnboardingCompleted(): Promise<boolean>
    /** Mark onboarding complete after the user selects starter models. */
    completeOnboarding(): Promise<void>
  }

  /**
   * Auto-update lifecycle. The main process drives downloads; the UI just
   * subscribes to events and triggers user-confirmed actions.
   */
  updater: {
    /** Manually trigger an update check (the app also checks on launch + every 4h). */
    check(): Promise<void>
    /** Start downloading the available update. Progress arrives via onProgress. */
    download(): Promise<void>
    /** Quit the app and install the downloaded update. */
    install(): Promise<void>
    /** A new version is available on the server. */
    onAvailable(cb: (info: UpdateInfoPayload) => void): () => void
    /** Download progress for the update zip. */
    onProgress(cb: (progress: UpdateProgressPayload) => void): () => void
    /** Update zip finished downloading; ready to install on next quit. */
    onDownloaded(cb: (info: UpdateInfoPayload) => void): () => void
    /** Updater hit an error (network, signature mismatch, etc.). */
    onError(cb: (err: UpdateErrorPayload) => void): () => void
  }

  /** License activation, device-bound. Covers both Pro (1-year) and Unlimited (lifetime). */
  license: {
    /** Whether a valid license is stored locally for this device. */
    getStatus(): Promise<LicenseStatus>
    /**
     * Validate and activate a license key against the Arco license server.
     * Always returns a `message` from the server for display in the UI.
     */
    activate(key: string): Promise<LicenseActivationResult>
    /** Stable hardware fingerprint for this machine (node-machine-id). */
    getDeviceId(): Promise<string>
    /**
     * Pricing page URL for purchasing a license ({base}/pricing).
     * `null` only when the license API base is not configured.
     */
    getCheckoutUrl(): Promise<string | null>
  }
}

/**
 * IPC channel names. Centralized so the preload bridge and the backend
 * handlers can't drift apart over a typo'd string. Never type these strings
 * by hand elsewhere — import from here.
 */
export const CHANNELS = {
  sessions: {
    getCurrent: 'sessions:getCurrent',
    list: 'sessions:list',
    canCreate: 'sessions:canCreate',
    create: 'sessions:create',
    load: 'sessions:load',
    delete: 'sessions:delete',
    setTitle: 'sessions:setTitle',
    setLayout: 'sessions:setLayout',
    addThread: 'sessions:addThread',
    updateThreadModel: 'sessions:updateThreadModel',
    deleteThread: 'sessions:deleteThread',
    reorderThreads: 'sessions:reorderThreads',
    addMessage: 'sessions:addMessage'
  },
  chat: {
    start: 'chat:start',
    abort: 'chat:abort',
    delta: 'chat:delta',
    done: 'chat:done',
    error: 'chat:error'
  },
  summary: {
    start: 'summary:start',
    abort: 'summary:abort',
    delta: 'summary:delta',
    done: 'summary:done',
    error: 'summary:error'
  },
  settings: {
    getKeyStatus: 'settings:getKeyStatus',
    validateKey: 'settings:validateKey',
    saveKey: 'settings:saveKey',
    clearKey: 'settings:clearKey',
    getBalance: 'settings:getBalance',
    getSavedModels: 'settings:getSavedModels',
    setSavedModels: 'settings:setSavedModels',
    addSavedModel: 'settings:addSavedModel',
    removeSavedModel: 'settings:removeSavedModel',
    validateModel: 'settings:validateModel',
    isOnboardingCompleted: 'settings:isOnboardingCompleted',
    completeOnboarding: 'settings:completeOnboarding'
  },
  license: {
    getStatus: 'license:getStatus',
    activate: 'license:activate',
    getDeviceId: 'license:getDeviceId',
    getCheckoutUrl: 'license:getCheckoutUrl'
  },
  updater: {
    check: 'updater:check',
    download: 'updater:download',
    install: 'updater:install',
    available: 'updater:available',
    progress: 'updater:progress',
    downloaded: 'updater:downloaded',
    error: 'updater:error'
  }
} as const
