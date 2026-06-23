/**
 * IPC handlers for conversation persistence.
 *
 * Each handler is a thin adapter: it receives a request from the UI over a
 * named channel and forwards it to the repository (which does the SQL). Using
 * `ipcMain.handle` makes each call a normal request→response (the UI awaits a
 * Promise) — the IPC equivalent of an HTTP endpoint.
 *
 * All business logic lives in sessions.repo.ts; this file only wires IPC
 * channels to repository functions.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { ipcMain } from 'electron'
import { CHANNELS } from '@shared/api-contract'
import type { Role } from '@shared/types'
import * as repo from '../db/repositories/sessions.repo'

/**
 * Register all session-related IPC handlers.
 *
 * @used-by registerIpcHandlers in ipc/index.ts
 */
export function registerSessionHandlers(): void {
  // ── Session lifecycle ─────────────────────────────────────────────────────
  /** Get or create the active session (called on app startup). */
  ipcMain.handle(CHANNELS.sessions.getCurrent, () => repo.getCurrentSession())
  /** List all sessions for the sidebar, newest first. */
  ipcMain.handle(CHANNELS.sessions.list, () => repo.listSessions())
  /** Check if user can create another session (free tier limit). */
  ipcMain.handle(CHANNELS.sessions.canCreate, () => repo.canCreateSession())
  /** Create a new session and make it active. */
  ipcMain.handle(CHANNELS.sessions.create, () => repo.createSession())
  /** Switch to and load an existing session. */
  ipcMain.handle(CHANNELS.sessions.load, (_e, sessionId: number) => repo.loadSession(sessionId))
  /** Permanently delete a session (threads + messages cascade). */
  ipcMain.handle(CHANNELS.sessions.delete, (_e, sessionId: number) => repo.deleteSession(sessionId))
  /** Update a session's title (sidebar label). */
  ipcMain.handle(CHANNELS.sessions.setTitle, (_e, sessionId: number, title: string) =>
    repo.setSessionTitle(sessionId, title)
  )
  /** Update a session's visible pane count. */
  ipcMain.handle(CHANNELS.sessions.setLayout, (_e, sessionId: number, layout: number) =>
    repo.setSessionLayout(sessionId, layout)
  )

  // ── Thread (pane) management ──────────────────────────────────────────────
  /** Add a new model thread at a grid slot. */
  ipcMain.handle(CHANNELS.sessions.addThread, (_e, sessionId: number, slot: number, openRouterModelId: string, label: string) =>
    repo.addThread(sessionId, slot, openRouterModelId, label)
  )
  /** Change a thread's model and clear its messages. */
  ipcMain.handle(CHANNELS.sessions.updateThreadModel, (_e, threadId: number, openRouterModelId: string, label: string) =>
    repo.updateThreadModel(threadId, openRouterModelId, label)
  )
  /** Remove a thread from a session. */
  ipcMain.handle(CHANNELS.sessions.deleteThread, (_e, threadId: number) => repo.deleteThread(threadId))
  /** Reorder threads to match new grid layout. */
  ipcMain.handle(CHANNELS.sessions.reorderThreads, (_e, threadIds: number[]) => repo.reorderThreads(threadIds))

  // ── Message persistence ───────────────────────────────────────────────────
  /** Append a message to a thread. */
  ipcMain.handle(CHANNELS.sessions.addMessage, (_e, threadId: number, role: Role, content: string) =>
    repo.addMessage(threadId, role, content)
  )
}
