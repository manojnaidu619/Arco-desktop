/**
 * Conversation persistence — all reads/writes for sessions, threads, and
 * messages live here. The IPC layer (electron/ipc/sessions.ts) calls these
 * functions; this file is the only place that knows SQL/Drizzle.
 *
 * This is a straight, cleaned-up port of the original web app's `/api/session`
 * route handlers — same behavior, but as plain functions instead of HTTP
 * endpoints.
 */
import { asc, count, desc, eq, inArray } from 'drizzle-orm'
import { getDb } from '../client'
import { messages, sessions, threads } from '../schema'
import type { Role, SessionData, SessionSummary, ThreadData } from '@shared/types'

/** Current timestamp as an ISO string (how all dates are stored). */
const now = () => new Date().toISOString()

/**
 * Assemble the full pane (thread) + message tree for a session, plus its grid
 * layout. Shared by `getCurrentSession` and `loadSession`.
 */
function buildSessionData(sessionId: number): SessionData {
  const db = getDb()

  const session = db.select({ layout: sessions.layout }).from(sessions).where(eq(sessions.id, sessionId)).get()
  const layout = session?.layout ?? 4

  const sessionThreads = db
    .select()
    .from(threads)
    .where(eq(threads.sessionId, sessionId))
    .orderBy(asc(threads.slot), asc(threads.createdAt))
    .all()

  const threadIds = sessionThreads.map((t) => t.id)

  // One query for all messages across the session's threads, then group
  // them in memory — avoids an N+1 query per thread.
  const allMessages =
    threadIds.length > 0
      ? db
          .select()
          .from(messages)
          .where(inArray(messages.threadId, threadIds))
          .orderBy(asc(messages.seq))
          .all()
      : []

  // Slot = position in the ordered list. Threads are always contiguous from
  // slot 0 (empty panes only ever sit at the tail with no thread row), so the
  // array index equals the intended slot. Using the index also repairs legacy
  // rows that predate the `slot` column (all defaulted to 0).
  const threadData: ThreadData[] = sessionThreads.map((t, index) => ({
    threadId: t.id,
    slot: index,
    modelId: t.modelId,
    label: t.label,
    messages: allMessages
      .filter((m) => m.threadId === t.id)
      .map((m) => ({ role: m.role as Role, content: m.content }))
  }))

  return { sessionId, layout, threads: threadData }
}

/**
 * Get the active session, creating a fresh one if none exists.
 * Called once on app launch to restore where the user left off.
 */
export function getCurrentSession(): SessionData {
  const db = getDb()
  const ts = now()

  let session = db.select().from(sessions).where(eq(sessions.isActive, true)).limit(1).get()

  if (!session) {
    session = db
      .insert(sessions)
      .values({ createdAt: ts, updatedAt: ts, isActive: true })
      .returning()
      .get()
  }

  return buildSessionData(session.id)
}

/** List every session for the sidebar (newest first), with its model dots. */
export function listSessions(): SessionSummary[] {
  const db = getDb()

  const allSessions = db.select().from(sessions).orderBy(desc(sessions.updatedAt)).all()

  return allSessions.map((s) => {
    const sessionThreads = db
      .select({ modelId: threads.modelId, label: threads.label })
      .from(threads)
      .where(eq(threads.sessionId, s.id))
      .all()

    return {
      id: s.id,
      title: s.title ?? null,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      isActive: s.isActive,
      layout: s.layout ?? 4,
      models: sessionThreads.map((t) => ({ modelId: t.modelId, label: t.label }))
    }
  })
}

/** Create a fresh session, deactivating any currently-active one. */
export function createSession(): number {
  const db = getDb()
  const ts = now()

  db.update(sessions).set({ isActive: false, updatedAt: ts }).where(eq(sessions.isActive, true)).run()

  const created = db
    .insert(sessions)
    .values({ createdAt: ts, updatedAt: ts, isActive: true })
    .returning()
    .get()

  return created.id
}

/** Switch the active session to `sessionId` and return its full data. */
export function loadSession(sessionId: number): SessionData {
  const db = getDb()
  const ts = now()

  db.update(sessions).set({ isActive: false, updatedAt: ts }).where(eq(sessions.isActive, true)).run()
  db.update(sessions).set({ isActive: true, updatedAt: ts }).where(eq(sessions.id, sessionId)).run()

  return buildSessionData(sessionId)
}

/** Permanently delete a session. Threads + messages cascade away via FK. */
export function deleteSession(sessionId: number): void {
  getDb().delete(sessions).where(eq(sessions.id, sessionId)).run()
}

/** Set a session's title (capped at 120 chars to keep the sidebar tidy). */
export function setSessionTitle(sessionId: number, title: string): void {
  getDb()
    .update(sessions)
    .set({ title: String(title).slice(0, 120), updatedAt: now() })
    .where(eq(sessions.id, sessionId))
    .run()
}

/** Set a session's grid layout (number of visible panes). */
export function setSessionLayout(sessionId: number, layout: number): void {
  getDb().update(sessions).set({ layout, updatedAt: now() }).where(eq(sessions.id, sessionId)).run()
}

/** Add a pane (thread) at a grid slot; returns the new thread id. */
export function addThread(sessionId: number, slot: number, modelId: string, label: string): number {
  const created = getDb()
    .insert(threads)
    .values({ sessionId, slot, modelId, label, createdAt: now() })
    .returning()
    .get()

  return created.id
}

/**
 * Change a pane's model and CLEAR its messages — switching the model starts a
 * fresh conversation for that pane. The thread row (and its slot) is reused so
 * the pane keeps its grid position.
 */
export function updateThreadModel(threadId: number, modelId: string, label: string): void {
  const db = getDb()
  db.update(threads).set({ modelId, label }).where(eq(threads.id, threadId)).run()
  db.delete(messages).where(eq(messages.threadId, threadId)).run()
}

/** Remove a model thread. Its messages cascade away via FK. */
export function deleteThread(threadId: number): void {
  getDb().delete(threads).where(eq(threads.id, threadId)).run()
}

/**
 * Re-slot threads to match a new grid order. `threadIds` is the desired order;
 * each thread's `slot` is set to its index. Used when the user reorders/reselects
 * which panes are visible so the new order survives a reload (slot drives the
 * ordering in `buildSessionData`).
 */
export function reorderThreads(threadIds: number[]): void {
  const db = getDb()
  db.transaction((tx) => {
    threadIds.forEach((id, index) => {
      tx.update(threads).set({ slot: index }).where(eq(threads.id, id)).run()
    })
  })
}

/** Append a message to a thread, computing its sequence number. */
export function addMessage(threadId: number, role: Role, content: string): void {
  const db = getDb()

  // The new message's seq is the current count (0-based append).
  const result = db.select({ value: count() }).from(messages).where(eq(messages.threadId, threadId)).get()
  const seq = result?.value ?? 0

  db.insert(messages).values({ threadId, role, content, seq, createdAt: now() }).run()
}
