/**
 * Core domain types shared between the main process and the renderer.
 *
 * "Shared" means: this file is imported by BOTH the backend (electron/) and
 * the UI (src/). Keep it free of any Node- or browser-specific code — just
 * plain data shapes.
 */

/** Who authored a message in a conversation. */
export type Role = 'user' | 'assistant'

/** A single chat message in one model's thread. */
export interface Message {
  role: Role
  content: string
}

/** Lifecycle status of one model's thread in the UI. */
export type ThreadStatus = 'idle' | 'streaming' | 'error' | 'done'

/**
 * One model's conversation column as held in the UI's state.
 * `dbThreadId` is the row id once the thread has been persisted to SQLite.
 */
export interface ModelThread {
  modelId: string
  label: string
  messages: Message[]
  status: ThreadStatus
  error?: string
  dbThreadId?: number
}

/* ── Shapes returned by the backend over IPC ──────────────────────────── */

/** One persisted thread (a grid slot/pane) plus its full message history. */
export interface ThreadData {
  threadId: number
  /** Grid position 0..5 — a pane's stable identity within the session. */
  slot: number
  modelId: string
  label: string
  messages: Message[]
}

/** A full session: its id, its grid layout, and every thread (pane) it holds. */
export interface SessionData {
  sessionId: number
  /** Number of visible panes: one of 1 | 2 | 3 | 4 | 6. */
  layout: number
  threads: ThreadData[]
}

/** A lightweight session row for the history sidebar. */
export interface SessionSummary {
  id: number
  title: string | null
  createdAt: string
  updatedAt: string
  isActive: boolean
  /** Number of visible panes for this session. */
  layout: number
  /** Distinct models used in this session — drives the colored dots. */
  models: { modelId: string; label: string }[]
}
