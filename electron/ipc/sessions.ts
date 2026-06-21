/**
 * IPC handlers for conversation persistence.
 *
 * Each handler is a thin adapter: it receives a request from the UI over a
 * named channel and forwards it to the repository (which does the SQL). Using
 * `ipcMain.handle` makes each call a normal request→response (the UI awaits a
 * Promise) — the IPC equivalent of an HTTP endpoint.
 */
import { ipcMain } from 'electron'
import { CHANNELS } from '@shared/api-contract'
import type { Role } from '@shared/types'
import * as repo from '../db/repositories/sessions.repo'

export function registerSessionHandlers(): void {
  ipcMain.handle(CHANNELS.sessions.getCurrent, () => repo.getCurrentSession())
  ipcMain.handle(CHANNELS.sessions.list, () => repo.listSessions())
  ipcMain.handle(CHANNELS.sessions.canCreate, () => repo.canCreateSession())
  ipcMain.handle(CHANNELS.sessions.create, () => repo.createSession())
  ipcMain.handle(CHANNELS.sessions.load, (_e, sessionId: number) => repo.loadSession(sessionId))
  ipcMain.handle(CHANNELS.sessions.delete, (_e, sessionId: number) => repo.deleteSession(sessionId))
  ipcMain.handle(CHANNELS.sessions.setTitle, (_e, sessionId: number, title: string) =>
    repo.setSessionTitle(sessionId, title)
  )
  ipcMain.handle(CHANNELS.sessions.setLayout, (_e, sessionId: number, layout: number) =>
    repo.setSessionLayout(sessionId, layout)
  )
  ipcMain.handle(CHANNELS.sessions.addThread, (_e, sessionId: number, slot: number, modelId: string, label: string) =>
    repo.addThread(sessionId, slot, modelId, label)
  )
  ipcMain.handle(CHANNELS.sessions.updateThreadModel, (_e, threadId: number, modelId: string, label: string) =>
    repo.updateThreadModel(threadId, modelId, label)
  )
  ipcMain.handle(CHANNELS.sessions.deleteThread, (_e, threadId: number) => repo.deleteThread(threadId))
  ipcMain.handle(CHANNELS.sessions.reorderThreads, (_e, threadIds: number[]) => repo.reorderThreads(threadIds))
  ipcMain.handle(CHANNELS.sessions.addMessage, (_e, threadId: number, role: Role, content: string) =>
    repo.addMessage(threadId, role, content)
  )
}
