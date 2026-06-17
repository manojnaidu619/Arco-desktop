// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOCUMENTATION CONTRACT — read before editing this file
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//
// This file is intentionally written for both human developers and AI agents.
// Every function must carry a JSDoc block in the following format:
//
//   /**
//    * <One-line summary.>
//    *
//    * @used-by  <UI component or hook that calls this>
//    * @param    <name> — <description>
//    * @returns  <what it returns, if anything>
//    *
//    * Internal steps:  (Tier 2 only — complex multi-stage functions)
//    *  1. …
//    *  2. …
//    */
//
// Rules:
//  • When you ADD a new function  → write its full JSDoc before committing.
//  • When you CHANGE a function   → update its JSDoc to reflect the new behaviour.
//  • When you REMOVE a function   → remove its JSDoc with it.
//  • Inline comments              → only on non-obvious lines; never narrate the obvious.
//  • @used-by                     → always keep current; stale call-site info is worse
//                                   than none.
//
// Common mistakes to avoid:
//  ✗ Reading `panes` state inside a callback    → use `panesRef.current` instead
//  ✗ Reading `sessionId` state in async code   → use `sessionIdRef.current` instead
//  ✗ Calling setPanes with a full replacement  → use `patchPane(slot, patch)` instead
//  ✗ Adding a new slot-keyed useRef map without updating the `remapKeys` calls
//    inside `applyVisibleSelection` → slot reassignment will silently break it
//
// This contract applies to all contributors — human or AI — without exception.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * useChat — the renderer's conversation state machine (grid/pane model).
 *
 * Multi-Mind is a multi-model broadcast chat: one composer sends the same prompt
 * to every visible pane, and each pane streams its model's reply independently.
 *
 * A "pane" is a GRID SLOT, not a model. The session holds a pool of panes
 * (`panes`, indexed so `panes[i].slot === i`) plus the active `layout` (how
 * many panes are visible: 1|2|3|4|6). The same model may appear in multiple
 * panes, because identity is the slot — not the model.
 *
 *   • Visible panes  = panes.slice(0, layout)
 *   • Grow layout    → append pre-filled panes (high-water mark, never shrinks)
 *   • Shrink layout  → just lower `layout`; hidden panes keep their data
 *
 * State talks to the backend only through `window.api` (src/lib/api.ts).
 * Streaming is event-based and routed by a per-request id mapped to a slot, so
 * duplicate models stream independently.
 *
 * Ref vs state: `useState` drives re-renders; `useRef` mirrors hold the latest
 * values for IPC handlers and async callbacks where closures would go stale.
 *
 * Smooth streaming reveal is handled by flowtoken's AnimatedMarkdown in
 * MessageBubble.tsx (animation only). All markdown styling is our own Tailwind
 * overrides via customComponents; the same renderer runs while streaming and
 * after completion.
 *
 * For a full step-by-step diagram of the streaming pipeline, see
 * docs/internals/streaming-pipeline.md
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { useSavedModels } from '@/hooks/useSavedModels'
import { getModelDef, isModelInLibrary } from '@shared/models'
import type { Message, SessionData, SessionSummary, ThreadStatus } from '@shared/types'

/** Re-exported so consumers can import session types from this hook alone. */
export type { SessionSummary }

/** Valid pane-count presets; each maps to a grid layout option in the toolbar. */
export const LAYOUTS = [1, 2, 3, 4, 6] as const

/** One grid slot. `modelId === null` means an empty pane awaiting selection. */
export interface Pane {
  slot: number // Zero-based index; also the pane's grid position (0 = top-left)
  modelId: string | null // AI model assigned to this pane; null = empty, awaiting selection
  label: string // Human-readable model name shown in the pane header (e.g. "DeepSeek V4 Flash")
  messages: Message[] // Full conversation history for this pane, in chronological order
  status: ThreadStatus // Current state: 'idle' | 'streaming' | 'done' | 'error'
  error?: string // Error message displayed in the pane when status === 'error'
  dbThreadId?: number // Primary key of this pane's thread row in the local SQLite DB; undefined for unsaved panes
}

/** Each streaming request gets a unique UUID so delta events route to the correct pane. */
const generateRequestId = () => crypto.randomUUID()

/**
 * Snap any number to the nearest valid layout preset (default 4).
 *
 * @param n — raw pane count (e.g. from persisted session data)
 * @returns nearest value from LAYOUTS
 */
function clampLayout(n: number): number {
  if ((LAYOUTS as readonly number[]).includes(n)) return n
  // Pick the preset whose distance from n is smallest; ties prefer the closer preset.
  return LAYOUTS.reduce((best, l) => (Math.abs(l - n) < Math.abs(best - n) ? l : best), 4)
}

/**
 * Create an empty pane at a slot (no model selected yet).
 *
 * @param slot — grid index for the new pane
 */
function emptyPane(slot: number): Pane {
  return { slot, modelId: null, label: '', messages: [], status: 'idle' }
}

export function useChat() {
  const { savedModels } = useSavedModels()

  // ── Persisted state (drives re-renders) ─────────────────────────────────
  const [sessionId, setSessionId] = useState<number | null>(null) // DB id of the active session; null during initial load
  const [panes, setPanes] = useState<Pane[]>([]) // Full pane pool (visible + hidden); length is always >= layout
  const [layout, setLayoutState] = useState<number>(4) // How many panes are visible right now (must be one of LAYOUTS)
  const [sessions, setSessions] = useState<SessionSummary[]>([]) // Sidebar session list
  const [loading, setLoading] = useState(true) // True until the first session load completes; hides the UI

  // ── Always-fresh ref mirrors (for callbacks & async closures) ────────────
  // State captured in a closure becomes stale after re-renders.
  // Reassigning these refs on every render keeps event handlers up to date
  // without requiring them to be recreated on every render cycle.
  const panesRef = useRef<Pane[]>([]) // Live mirror of `panes`; read inside IPC delta/done/error handlers
  panesRef.current = panes
  const sessionIdRef = useRef<number | null>(null) // Live mirror of `sessionId`; read inside async session actions
  sessionIdRef.current = sessionId

  // ── Streaming routing maps ────────────────────────────────────────────────
  const reqToSlot = useRef<Record<string, number>>({}) // requestId → slot: routes incoming delta events to the correct pane
  const activeReqBySlot = useRef<Record<number, string>>({}) // slot → requestId: lets stop/abort find and cancel a pane's active request

  // ── Session title flag ───────────────────────────────────────────────────
  const titleSet = useRef(false) // Flips to true after the first message auto-sets the session title; prevents overwriting it on follow-ups

  /** True when any pane is actively streaming. */
  const isAnyStreaming = useCallback(() => panesRef.current.some((p) => p.status === 'streaming'), [])

  /**
   * Reload the sidebar session list from the backend.
   *
   * @used-by  internal — called after send, rename, delete, new session, and finalize
   */
  const refreshSessions = useCallback(async () => {
    setSessions(await api.sessions.list())
  }, [])

  /**
   * Immutably update one pane in the pool by slot index.
   *
   * @used-by  internal — preferred over setPanes for single-pane updates
   * @param    slot  — grid slot to patch (slot === array index)
   * @param    patch — partial Pane fields to merge
   */
  const patchPane = useCallback((slot: number, patch: Partial<Pane>) => {
    setPanes((prev) => prev.map((p) => (p.slot === slot ? { ...p, ...patch } : p)))
  }, [])

  /**
   * Bootstrap and persist default panes for slots [from, to).
   *
   * @used-by  applySessionData, setLayout, newSession, deleteSession
   * @param    targetSessionId — session to attach new thread rows to
   * @param    from — first slot index (inclusive)
   * @param    to — last slot index (exclusive)
   * @returns  array of Pane objects for the requested range
   */
  const buildDefaultPanes = useCallback(async (targetSessionId: number, from: number, to: number) => {
    const savedModelIds = await api.settings.getSavedModels()
    const result: Pane[] = []
    for (let slot = from; slot < to; slot++) {
      const modelId = savedModelIds[slot]
      if (modelId) {
        const def = getModelDef(modelId)
        const dbThreadId = await api.sessions.addThread(targetSessionId, slot, def.id, def.label)
        result.push({ slot, modelId: def.id, label: def.label, messages: [], status: 'idle', dbThreadId })
      } else {
        result.push(emptyPane(slot))
      }
    }
    return result
  }, [])

  /**
   * Convert loaded SessionData from the backend into the live pane pool.
   *
   * @used-by  initial load useEffect, loadSession
   * @param    data — session payload from api.sessions.getCurrent / load
   *
   * Internal steps:
   *  1. Clamp layout to a valid LAYOUTS preset.
   *  2. If no threads exist, pre-fill default panes for slots [0, layout).
   *  3. Otherwise rebuild the pool from saved threads; poolSize is max(layout,
   *     highest saved slot + 1) so no slot with data is dropped.
   *  4. Set layout state to the clamped value.
   */
  const applySessionData = useCallback(
    async (data: SessionData) => {
      const lyt = clampLayout(data.layout)

      if (data.threads.length === 0) {
        const fresh = await buildDefaultPanes(data.sessionId, 0, lyt)
        setPanes(fresh)
      } else {
        // Ensure we restore every slot that has a saved thread, even if layout shrank.
        const poolSize = Math.max(lyt, ...data.threads.map((t) => t.slot + 1))
        const restored: Pane[] = []
        for (let slot = 0; slot < poolSize; slot++) {
          const t = data.threads.find((x) => x.slot === slot)
          restored.push(
            t
              ? { slot, modelId: t.modelId, label: t.label, messages: t.messages, status: 'idle', dbThreadId: t.threadId }
              : emptyPane(slot)
          )
        }
        setPanes(restored)
      }
      setLayoutState(lyt)
    },
    [buildDefaultPanes]
  )

  /**
   * Persist a completed assistant response and mark the pane as done.
   *
   * @used-by  onDone IPC handler
   * @param    slot — grid slot whose stream just completed
   * @param    content — full final text of the assistant response
   *
   * Internal steps:
   *  1. Look up the pane via `panesRef` (safe inside async/event callbacks).
   *  2. Persist the assistant message if the pane has a DB thread and content is non-empty.
   *  3. Patch status to 'done' and refresh the sidebar list.
   */
  const finalizeSlot = useCallback(
    async (slot: number, content: string) => {
      const pane = panesRef.current.find((p) => p.slot === slot)
      if (pane?.dbThreadId && content) await api.sessions.addMessage(pane.dbThreadId, 'assistant', content)
      patchPane(slot, { status: 'done' })
      refreshSessions()
    },
    [patchPane, refreshSessions]
  )

  /**
   * Register IPC handlers for streaming deltas, completion, and errors (once on mount).
   *
   * @used-by  useChat mount lifecycle
   *
   * Internal steps:
   *  1. onDelta — append token directly to the last assistant message in the pane;
   *     AnimatedMarkdown in MessageBubble renders markdown with shared custom
   *     styles; new words fade in while streaming.
   *  2. onDone — clear routing maps and call finalizeSlot to persist the response.
   *  3. onError — show error state on the pane.
   *  4. Cleanup — unsubscribe all handlers on unmount.
   */
  useEffect(() => {
    const offDelta = api.chat.onDelta(({ requestId, delta }) => {
      const slot = reqToSlot.current[requestId]
      if (slot === undefined) return
      // Append delta directly; React 19 automatic batching keeps re-renders at 60fps.
      setPanes((prev) =>
        prev.map((p) => {
          if (p.slot !== slot) return p
          const msgs = [...p.messages]
          const last = msgs[msgs.length - 1]
          if (last?.role === 'assistant') msgs[msgs.length - 1] = { role: 'assistant', content: last.content + delta }
          return { ...p, messages: msgs }
        })
      )
    })

    const offDone = api.chat.onDone(async ({ requestId, content }) => {
      const slot = reqToSlot.current[requestId]
      if (slot === undefined) return
      delete reqToSlot.current[requestId]
      if (activeReqBySlot.current[slot] === requestId) delete activeReqBySlot.current[slot]
      await finalizeSlot(slot, content)
    })

    const offError = api.chat.onError(({ requestId, message }) => {
      const slot = reqToSlot.current[requestId]
      if (slot === undefined) return
      delete reqToSlot.current[requestId]
      if (activeReqBySlot.current[slot] === requestId) delete activeReqBySlot.current[slot]

      setPanes((prev) =>
        prev.map((p) => {
          if (p.slot !== slot) return p
          const messages =
            p.messages.at(-1)?.role === 'assistant' && p.messages.at(-1)?.content === ''
              ? p.messages.slice(0, -1)
              : p.messages
          return { ...p, status: 'error', error: message, messages }
        })
      )
    })

    return () => {
      offDelta()
      offDone()
      offError()
    }
  }, [finalizeSlot])

  /**
   * Load the current session and sidebar list once on mount.
   *
   * @used-by  useChat mount lifecycle
   *
   * Internal steps:
   *  1. Fetch current session and session list in parallel.
   *  2. Apply session data to rebuild panes; set titleSet if session already has a title.
   *  3. Clear loading flag so MainApp renders the grid.
   */
  useEffect(() => {
    Promise.all([api.sessions.getCurrent(), api.sessions.list()])
      .then(async ([current, sessionList]) => {
        setSessionId(current.sessionId)
        titleSet.current = !!sessionList.find((s) => s.id === current.sessionId)?.title
        await applySessionData(current)
        setSessions(sessionList)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Abort every in-flight stream and clear all runtime routing maps.
   *
   * @used-by  newSession, loadSession, deleteSession
   */
  const cancelStreams = useCallback(() => {
    for (const requestId of Object.keys(reqToSlot.current)) api.chat.abort(requestId)
    reqToSlot.current = {}
    activeReqBySlot.current = {}
  }, [])

  /**
   * Stop a pane's in-flight stream and keep partial assistant content.
   *
   * @used-by  abort, abortPane
   * @param    slot — grid slot to stop
   *
   * Internal steps:
   *  1. Abort the active request and clear routing state for the slot.
   *  2. Keep the user message; keep or drop the assistant placeholder based on content.
   *  3. Persist non-empty partial assistant text; mark stopped in UI.
   */
  const stopPane = useCallback(
    (slot: number) => {
      const req = activeReqBySlot.current[slot]
      if (req) {
        api.chat.abort(req)
        delete reqToSlot.current[req]
        delete activeReqBySlot.current[slot]
      }

      const pane = panesRef.current.find((p) => p.slot === slot)
      const lastMsg = pane?.messages.at(-1)
      const partial = lastMsg?.role === 'assistant' ? lastMsg.content : ''

      setPanes((prev) =>
        prev.map((p) => {
          if (p.slot !== slot) return p
          let msgs = [...p.messages]
          const assistant = msgs.at(-1)
          if (assistant?.role === 'assistant') {
            if (partial) {
              msgs[msgs.length - 1] = { role: 'assistant', content: partial, stopped: true }
            } else {
              msgs = msgs.slice(0, -1)
            }
          }
          return { ...p, messages: msgs, status: 'idle', error: undefined }
        })
      )

      if (partial && pane?.dbThreadId) {
        api.sessions.addMessage(pane.dbThreadId, 'assistant', partial).then(() => refreshSessions())
      }
    },
    [refreshSessions]
  )

  /**
   * Stop all streaming panes (bottom bar stop button).
   *
   * @used-by  MainApp → ChatBar onAbort
   * @see      abortPane — per-pane counterpart
   */
  const abort = useCallback(() => {
    const streamingSlots = panesRef.current.filter((p) => p.status === 'streaming').map((p) => p.slot)
    streamingSlots.forEach((slot) => stopPane(slot))
  }, [stopPane])

  /**
   * Stop streaming for a single pane (pane stop button).
   *
   * @used-by  MainApp → ModelPane onAbortPane
   * @param    slot — grid slot to stop
   * @see      abort — global counterpart for all streaming panes
   */
  const abortPane = useCallback(
    (slot: number) => {
      stopPane(slot)
    },
    [stopPane]
  )

  /**
   * Begin streaming a model response into a slot.
   *
   * @used-by  askAll, askOne
   * @param    slot — target grid slot
   * @param    model — model id to call
   * @param    requestMessages — full message history including the new user turn
   *
   * Internal steps:
   *  1. Abort any prior request on this slot.
   *  2. Allocate requestId and map it to the slot (both directions).
   *  3. Append an empty assistant placeholder and set status to 'streaming'.
   *  4. Fire api.chat.start with the request id and messages.
   */
  const startStream = useCallback((slot: number, model: string, requestMessages: Message[]) => {
    const prev = activeReqBySlot.current[slot]
    if (prev) {
      api.chat.abort(prev)
      delete reqToSlot.current[prev]
    }

    const requestId = generateRequestId()
    activeReqBySlot.current[slot] = requestId
    reqToSlot.current[requestId] = slot

    setPanes((prev2) =>
      prev2.map((p) =>
        p.slot === slot
          ? { ...p, messages: [...p.messages, { role: 'assistant', content: '' }], status: 'streaming', error: undefined }
          : p
      )
    )

    api.chat.start({ requestId, model, messages: requestMessages })
  }, [])

  /**
   * Change how many panes are visible (toolbar layout selector).
   *
   * @used-by  MainApp → LayoutSelector onChange
   * @param    next — desired pane count (clamped to LAYOUTS)
   */
  const setLayout = useCallback(
    async (next: number) => {
      const lyt = clampLayout(next)
      const sid = sessionIdRef.current
      if (sid === null) return

      if (lyt > panesRef.current.length) {
        const added = await buildDefaultPanes(sid, panesRef.current.length, lyt)
        setPanes((prev) => [...prev, ...added])
        refreshSessions()
      }
      setLayoutState(lyt)
      api.sessions.setLayout(sid, lyt)
    },
    [buildDefaultPanes, refreshSessions]
  )

  /**
   * Reorder the pane pool so selected models occupy the front slots.
   *
   * @used-by  MainApp → LayoutSelector onApplySelection
   * @param    selectedSlots — slots to keep visible (relative order preserved)
   * @param    targetLayout — new visible pane count
   *
   * Internal steps:
   *  1. Partition panes into selected (kept) and rest; concatenate for new order.
   *  2. Build oldSlot → newSlot remap and apply it to all slot-keyed runtime refs.
   *  3. Reassign pane.slot indices, update layout, persist thread order + layout.
   */
  const applyVisibleSelection = useCallback(
    (selectedSlots: number[], targetLayout: number) => {
      const sid = sessionIdRef.current
      if (sid === null) return

      const selected = new Set(selectedSlots)
      const current = panesRef.current
      const kept = current.filter((p) => selected.has(p.slot))
      const rest = current.filter((p) => !selected.has(p.slot))
      const ordered = [...kept, ...rest]

      // oldSlot → newSlot — must stay in sync with every slot-keyed ref below.
      const remap: Record<number, number> = {}
      ordered.forEach((p, index) => {
        remap[p.slot] = index
      })

      const remapKeys = <T>(rec: Record<number, T>): Record<number, T> => {
        const next: Record<number, T> = {}
        for (const key of Object.keys(rec)) next[remap[Number(key)]] = rec[Number(key)]
        return next
      }
      activeReqBySlot.current = remapKeys(activeReqBySlot.current)
      for (const reqId of Object.keys(reqToSlot.current)) {
        reqToSlot.current[reqId] = remap[reqToSlot.current[reqId]]
      }

      const newPanes = ordered.map((p, index) => ({ ...p, slot: index }))
      setPanes(newPanes)
      setLayoutState(targetLayout)

      const threadIds = newPanes.filter((p) => p.dbThreadId).map((p) => p.dbThreadId!)
      if (threadIds.length > 0) api.sessions.reorderThreads(threadIds)
      api.sessions.setLayout(sid, targetLayout)
    },
    []
  )

  /**
   * Assign or change the model on a pane (clears its conversation).
   *
   * @used-by  MainApp → ModelPane onSelectModel
   * @param    slot — grid slot to update
   * @param    modelId — new model id (UI should confirm before calling if messages exist)
   */
  const setPaneModel = useCallback((slot: number, modelId: string) => {
    const sid = sessionIdRef.current
    if (sid === null) return
    const pane = panesRef.current.find((p) => p.slot === slot)
    if (!pane) return
    const label = getModelDef(modelId).label

    const active = activeReqBySlot.current[slot]
    if (active) api.chat.abort(active)

    if (pane.dbThreadId) {
      api.sessions.updateThreadModel(pane.dbThreadId, modelId, label)
      patchPane(slot, { modelId, label, messages: [], status: 'idle', error: undefined })
    } else {
      api.sessions.addThread(sid, slot, modelId, label).then((dbThreadId) => {
        patchPane(slot, { modelId, label, messages: [], status: 'idle', error: undefined, dbThreadId })
      })
    }
    refreshSessions()
  }, [patchPane, refreshSessions])

  /**
   * Broadcast the same user message to every visible pane that has a model.
   *
   * @used-by  MainApp → ChatBar onSend
   * @param    content — user message text
   * @see      askOne — single-pane counterpart for per-pane follow-up inputs
   *
   * Internal steps:
   *  1. Auto-set session title on the first message of a new session.
   *  2. For each visible pane with a model: persist user message, patch UI, startStream.
   */
  const askAll = useCallback(
    (content: string) => {
      const sid = sessionIdRef.current
      const visible = panesRef.current
        .slice(0, layout)
        .filter((p) => isModelInLibrary(p.modelId, savedModels))
      if (visible.length === 0) return

      if (!titleSet.current && sid !== null) {
        titleSet.current = true
        api.sessions.setTitle(sid, content).then(refreshSessions)
      }

      for (const pane of visible) {
        const updated: Message[] = [...pane.messages, { role: 'user', content }]
        if (pane.dbThreadId) api.sessions.addMessage(pane.dbThreadId, 'user', content)
        patchPane(pane.slot, { messages: updated })
        startStream(pane.slot, pane.modelId!, updated)
      }
    },
    [layout, patchPane, startStream, refreshSessions, savedModels]
  )

  /**
   * Send a follow-up message to a single pane.
   *
   * @used-by  MainApp → ModelPane onAskOne
   * @param    slot — target grid slot
   * @param    content — user message text
   * @see      askAll — broadcast counterpart for the bottom composer
   */
  const askOne = useCallback(
    (slot: number, content: string) => {
      const pane = panesRef.current.find((p) => p.slot === slot)
      if (!pane?.modelId || !isModelInLibrary(pane.modelId, savedModels)) return
      const updated: Message[] = [...pane.messages, { role: 'user', content }]
      if (pane.dbThreadId) api.sessions.addMessage(pane.dbThreadId, 'user', content)
      patchPane(slot, { messages: updated })
      startStream(slot, pane.modelId, updated)
    },
    [patchPane, startStream, savedModels]
  )

  /**
   * Create a new session (sidebar "+" button).
   *
   * @used-by  MainApp → Sidebar onNewSession, deleteSession (when none remain)
   * @param    options.force — skip the "reuse current empty session" shortcut
   * @returns  id of the active session (existing empty one or newly created)
   */
  const newSession = useCallback(async (options?: { force?: boolean }) => {
    if (isAnyStreaming()) return sessionIdRef.current ?? 0

    if (!options?.force) {
      const currentHasMessages = panesRef.current.some((p) => p.messages.length > 0)
      if (!currentHasMessages && sessionIdRef.current !== null) {
        return sessionIdRef.current
      }
    }

    cancelStreams()
    titleSet.current = false
    const newId = await api.sessions.create()
    setSessionId(newId)
    sessionIdRef.current = newId
    const fresh = await buildDefaultPanes(newId, 0, 4)
    setPanes(fresh)
    setLayoutState(4)
    refreshSessions()
    return newId
  }, [cancelStreams, buildDefaultPanes, refreshSessions, isAnyStreaming])

  /**
   * Switch to an existing session from the sidebar.
   *
   * @used-by  MainApp → Sidebar onSelectSession
   * @param    targetSessionId — session id to load
   */
  const loadSession = useCallback(
    async (targetSessionId: number) => {
      if (targetSessionId === sessionIdRef.current) return
      if (isAnyStreaming()) return
      cancelStreams()
      const data = await api.sessions.load(targetSessionId)
      titleSet.current = true
      setSessionId(data.sessionId)
      sessionIdRef.current = data.sessionId
      await applySessionData(data)
      refreshSessions()
    },
    [cancelStreams, applySessionData, refreshSessions, isAnyStreaming]
  )

  /**
   * Rename a session in the sidebar.
   *
   * @used-by  MainApp → Sidebar onRenameSession
   * @param    targetId — session id to rename
   * @param    title — new title
   */
  const renameSession = useCallback(
    async (targetId: number, title: string) => {
      await api.sessions.setTitle(targetId, title)
      refreshSessions()
    },
    [refreshSessions]
  )

  /**
   * Delete a session; if it is the active one, switch to the next sidebar entry.
   *
   * @used-by  MainApp → Sidebar onDeleteSession
   * @param    targetId — session id to delete
   *
   * Internal steps:
   *  1. Delete the session in the backend.
   *  2. If it was active: cancel streams, then load the newest remaining session
   *     (sidebar top — the item below if the deleted one was on top). If none
   *     remain, create a fresh empty session.
   *  3. Refresh the sidebar list.
   */
  const deleteSession = useCallback(
    async (targetId: number) => {
      if (isAnyStreaming()) return
      const wasActive = targetId === sessionIdRef.current
      await api.sessions.delete(targetId)
      if (wasActive) {
        cancelStreams()
        titleSet.current = false
        const remaining = await api.sessions.list()
        if (remaining.length > 0) {
          await loadSession(remaining[0].id)
        } else {
          // Last session gone — force a new one; plain newSession() would reuse the
          // deleted session id still held in sessionIdRef.
          await newSession({ force: true })
        }
        return
      }
      refreshSessions()
    },
    [cancelStreams, loadSession, newSession, refreshSessions, isAnyStreaming]
  )

  return {
    panes,
    layout,
    sessionId,
    sessions,
    loading,
    setLayout,
    applyVisibleSelection,
    setPaneModel,
    askAll,
    askOne,
    abort,
    abortPane,
    newSession,
    loadSession,
    renameSession,
    deleteSession,
    refreshSessions
  }
}
