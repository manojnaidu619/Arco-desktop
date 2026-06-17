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
 */

import type { Message, Role, SessionData, SessionSummary } from './types'

/* ── Chat streaming payloads ──────────────────────────────────────────────
 * Chat is special: instead of one request → one response, the answer streams
 * back token-by-token. So the UI STARTS a request (fire-and-forget) and then
 * LISTENS for a series of "delta" events, ending in "done" or "error". Each
 * request carries a `requestId` so the UI can tell concurrent streams apart.
 */
export interface ChatStartRequest {
  /** Unique id the UI generates to correlate the stream's events. */
  requestId: string
  /** OpenRouter model id to query. */
  model: string
  /** Full conversation so far (the last item is the new user turn). */
  messages: Message[]
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
}

/** Emitted once if a stream fails. */
export interface ChatErrorEvent {
  requestId: string
  message: string
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

/**
 * The complete `window.api` surface available to the UI.
 *
 * Grouped by domain (sessions / chat / settings) to mirror the backend
 * handler files. Adding a feature = add a method here, implement it in the
 * matching electron/ipc file, and wire it in preload.ts.
 */
export interface MultiMindApi {
  /** Conversation history persistence (SQLite-backed). */
  sessions: {
    /** Get the active session (creating one if none exists). */
    getCurrent(): Promise<SessionData>
    /** List all sessions for the sidebar, newest first. */
    list(): Promise<SessionSummary[]>
    /** Create a fresh session and make it active. Returns its id. */
    create(): Promise<number>
    /** Switch the active session and return its full data. */
    load(sessionId: number): Promise<SessionData>
    /** Permanently delete a session (threads + messages cascade). */
    delete(sessionId: number): Promise<void>
    /** Set a session's title (used for the sidebar label). */
    setTitle(sessionId: number, title: string): Promise<void>
    /** Set a session's grid layout (visible pane count: 1|2|3|4|6). */
    setLayout(sessionId: number, layout: number): Promise<void>
    /** Add a pane (thread) at a grid slot. Returns the new thread's id. */
    addThread(sessionId: number, slot: number, modelId: string, label: string): Promise<number>
    /** Change a pane's model and CLEAR its messages (fresh conversation). */
    updateThreadModel(threadId: number, modelId: string, label: string): Promise<void>
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

  /** API key management + the user's custom model list. */
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
    /** Get the user's saved custom (non-curated) model ids. */
    getCustomModels(): Promise<string[]>
    /** Add a custom model id; returns the updated list. */
    addCustomModel(modelId: string): Promise<string[]>
    /** Remove a custom model id; returns the updated list. */
    removeCustomModel(modelId: string): Promise<string[]>
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
  settings: {
    getKeyStatus: 'settings:getKeyStatus',
    validateKey: 'settings:validateKey',
    saveKey: 'settings:saveKey',
    clearKey: 'settings:clearKey',
    getBalance: 'settings:getBalance',
    getCustomModels: 'settings:getCustomModels',
    addCustomModel: 'settings:addCustomModel',
    removeCustomModel: 'settings:removeCustomModel'
  }
} as const
