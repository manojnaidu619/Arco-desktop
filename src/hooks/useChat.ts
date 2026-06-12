/**
 * useChat — the renderer's conversation state machine (grid/pane model).
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
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '@/lib/api'
import { CURATED_MODELS, getModelDef } from '@shared/models'
import type { Message, SessionData, SessionSummary, ThreadStatus } from '@shared/types'

export type { SessionSummary }

/** The grid layout presets, in order: pane counts. */
export const LAYOUTS = [1, 2, 3, 4, 6] as const

/** One grid slot. `modelId === null` means an empty pane awaiting selection. */
export interface Pane {
  slot: number
  modelId: string | null
  label: string
  messages: Message[]
  status: ThreadStatus
  error?: string
  dbThreadId?: number
}

const newRequestId = () => crypto.randomUUID()

/** Snap any number to the nearest valid layout preset (default 4). */
function clampLayout(n: number): number {
  if ((LAYOUTS as readonly number[]).includes(n)) return n
  return LAYOUTS.reduce((best, l) => (Math.abs(l - n) < Math.abs(best - n) ? l : best), 4)
}

/** An empty pane at a slot. */
function emptyPane(slot: number): Pane {
  return { slot, modelId: null, label: '', messages: [], status: 'idle' }
}

export function useChat() {
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [panes, setPanes] = useState<Pane[]>([])
  const [layout, setLayoutState] = useState<number>(4)
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)

  // Always-fresh mirrors for use inside event callbacks / async actions.
  const panesRef = useRef<Pane[]>([])
  panesRef.current = panes
  const sessionIdRef = useRef<number | null>(null)
  sessionIdRef.current = sessionId

  const reqToSlot = useRef<Record<string, number>>({})
  const activeReqBySlot = useRef<Record<number, string>>({})
  const titleSet = useRef(false)

  // Smooth-streaming: deltas land here first, then a per-frame loop reveals
  // them gradually into the pane's content so text glides in instead of
  // jumping in network-sized chunks. `doneInfoBySlot` holds the final content
  // for a slot whose stream finished while text was still draining.
  const pendingBySlot = useRef<Record<number, string>>({})
  const doneInfoBySlot = useRef<Record<number, { content: string }>>({})
  const revealFrame = useRef<number | null>(null)

  // Remember the text of the most recent send so an abort can restore it to the
  // input for editing/resending. `lastBroadcastContent` is the bottom "ask all"
  // text; `lastUserContentBySlot` is each pane's own follow-up text.
  const lastBroadcastContent = useRef<string>('')
  const lastUserContentBySlot = useRef<Record<number, string>>({})

  const refreshSessions = useCallback(async () => {
    setSessions(await api.sessions.list())
  }, [])

  /** Update a single pane by slot (slot === array index). */
  const patchPane = useCallback((slot: number, patch: Partial<Pane>) => {
    setPanes((prev) => prev.map((p) => (p.slot === slot ? { ...p, ...patch } : p)))
  }, [])

  /**
   * Create + persist default panes for slots [from, to). Each slot pre-fills
   * with the matching curated model; slots beyond the curated list stay empty.
   */
  const buildDefaultPanes = useCallback(async (targetSessionId: number, from: number, to: number) => {
    const result: Pane[] = []
    for (let slot = from; slot < to; slot++) {
      const model = CURATED_MODELS[slot]
      if (model) {
        const dbThreadId = await api.sessions.addThread(targetSessionId, slot, model.id, model.label)
        result.push({ slot, modelId: model.id, label: model.label, messages: [], status: 'idle', dbThreadId })
      } else {
        result.push(emptyPane(slot))
      }
    }
    return result
  }, [])

  /** Turn a loaded SessionData into the pane pool (restore or fresh-prefill). */
  const applySessionData = useCallback(
    async (data: SessionData) => {
      const lyt = clampLayout(data.layout)

      if (data.threads.length === 0) {
        // Brand-new session → pre-fill + persist the default panes.
        const fresh = await buildDefaultPanes(data.sessionId, 0, lyt)
        setPanes(fresh)
      } else {
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

  /** Persist + finalize a slot once its stream is done and fully revealed. */
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
   * One frame of the smooth-streaming reveal loop: pulls a portion of each
   * slot's buffered text into its message content. The portion scales with
   * the backlog so a burst of deltas catches up quickly while a steady trickle
   * still glides in smoothly.
   */
  const revealTick = useCallback(() => {
    // Advance each buffered slot by a chunk, computing everything in refs
    // FIRST. This stays out of the setPanes updater on purpose: that updater
    // must be pure (React may run it later or twice), and we need the finalize
    // list ready synchronously — not trapped inside a deferred render callback.
    const chunkBySlot: Record<number, string> = {}
    const toFinalize: { slot: number; content: string }[] = []

    for (const key of Object.keys(pendingBySlot.current)) {
      const slot = Number(key)
      const pending = pendingBySlot.current[slot]
      const take = Math.max(1, Math.ceil(pending.length / 6))
      chunkBySlot[slot] = pending.slice(0, take)
      const rest = pending.slice(take)
      if (rest) {
        pendingBySlot.current[slot] = rest
      } else {
        delete pendingBySlot.current[slot]
        if (doneInfoBySlot.current[slot]) {
          toFinalize.push({ slot, content: doneInfoBySlot.current[slot].content })
          delete doneInfoBySlot.current[slot]
        }
      }
    }

    setPanes((prev) =>
      prev.map((p) => {
        const chunk = chunkBySlot[p.slot]
        if (!chunk) return p
        const msgs = [...p.messages]
        const last = msgs[msgs.length - 1]
        if (last?.role === 'assistant') msgs[msgs.length - 1] = { role: 'assistant', content: last.content + chunk }
        return { ...p, messages: msgs }
      })
    )

    for (const { slot, content } of toFinalize) finalizeSlot(slot, content)

    if (Object.keys(pendingBySlot.current).length > 0) {
      revealFrame.current = requestAnimationFrame(revealTick)
    } else {
      revealFrame.current = null
    }
  }, [finalizeSlot])

  const ensureRevealing = useCallback(() => {
    if (revealFrame.current === null) revealFrame.current = requestAnimationFrame(revealTick)
  }, [revealTick])

  /**
   * Instantly reveal a slot's remaining buffered text and finalize it if its
   * stream already completed. Used when the response arrived in full but is
   * still gliding in — e.g. the user hit "stop" for a *different* pane and we
   * don't want this finished one left mid-glide.
   */
  const flushSlot = useCallback(
    (slot: number) => {
      const pending = pendingBySlot.current[slot]
      if (pending) {
        delete pendingBySlot.current[slot]
        setPanes((prev) =>
          prev.map((p) => {
            if (p.slot !== slot) return p
            const msgs = [...p.messages]
            const last = msgs[msgs.length - 1]
            if (last?.role === 'assistant') msgs[msgs.length - 1] = { role: 'assistant', content: last.content + pending }
            return { ...p, messages: msgs }
          })
        )
      }
      const doneInfo = doneInfoBySlot.current[slot]
      if (doneInfo) {
        delete doneInfoBySlot.current[slot]
        finalizeSlot(slot, doneInfo.content)
      }
    },
    [finalizeSlot]
  )

  /* ── Streaming event subscriptions (registered once) ─────────────────── */
  useEffect(() => {
    const offDelta = api.chat.onDelta(({ requestId, delta }) => {
      const slot = reqToSlot.current[requestId]
      if (slot === undefined) return
      pendingBySlot.current[slot] = (pendingBySlot.current[slot] ?? '') + delta
      ensureRevealing()
    })

    const offDone = api.chat.onDone(async ({ requestId, content }) => {
      const slot = reqToSlot.current[requestId]
      if (slot === undefined) return
      delete reqToSlot.current[requestId]
      if (activeReqBySlot.current[slot] === requestId) delete activeReqBySlot.current[slot]

      if (pendingBySlot.current[slot]) {
        // Still gliding in — finalize once the reveal loop drains the buffer.
        doneInfoBySlot.current[slot] = { content }
      } else {
        await finalizeSlot(slot, content)
      }
    })

    const offError = api.chat.onError(({ requestId, message }) => {
      const slot = reqToSlot.current[requestId]
      if (slot === undefined) return
      delete reqToSlot.current[requestId]
      if (activeReqBySlot.current[slot] === requestId) delete activeReqBySlot.current[slot]
      delete pendingBySlot.current[slot]
      delete doneInfoBySlot.current[slot]

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
      if (revealFrame.current !== null) cancelAnimationFrame(revealFrame.current)
    }
  }, [ensureRevealing, finalizeSlot])

  /* ── Initial load ────────────────────────────────────────────────────── */
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

  /** Silently cancel every in-flight stream (used when switching sessions). */
  const cancelStreams = useCallback(() => {
    for (const requestId of Object.keys(reqToSlot.current)) api.chat.abort(requestId)
    reqToSlot.current = {}
    activeReqBySlot.current = {}
    pendingBySlot.current = {}
    doneInfoBySlot.current = {}
  }, [])

  /**
   * Roll back a pane's in-flight turn: abort its stream, drop the (partial)
   * assistant placeholder AND the user message from the UI, and delete that
   * user message from the DB. Leaves the pane idle, as if the turn never
   * happened — the caller restores the text to the input.
   */
  const rollbackPane = useCallback((slot: number) => {
    const req = activeReqBySlot.current[slot]
    if (req) {
      api.chat.abort(req)
      delete reqToSlot.current[req]
      delete activeReqBySlot.current[slot]
    }
    delete pendingBySlot.current[slot]
    delete doneInfoBySlot.current[slot]
    const pane = panesRef.current.find((p) => p.slot === slot)
    if (pane?.dbThreadId) api.sessions.deleteLastMessage(pane.dbThreadId)

    setPanes((prev) =>
      prev.map((p) => {
        if (p.slot !== slot) return p
        let msgs = [...p.messages]
        if (msgs.at(-1)?.role === 'assistant') msgs = msgs.slice(0, -1) // drop assistant (partial/placeholder)
        if (msgs.at(-1)?.role === 'user') msgs = msgs.slice(0, -1) // drop the user turn
        return { ...p, messages: msgs, status: 'idle', error: undefined }
      })
    )
  }, [])

  /**
   * Abort all currently-streaming panes (the bottom "ask all" stop button).
   * Only panes whose request is still actually in flight get rolled back —
   * panes that already finished and are merely gliding their last bit of text
   * in are left alone (flushed instantly instead), so a slow model doesn't
   * wipe out answers that already arrived.
   * Returns the broadcast text so the composer can restore it for editing.
   */
  const abort = useCallback((): string => {
    const streamingSlots = panesRef.current.filter((p) => p.status === 'streaming').map((p) => p.slot)
    streamingSlots.forEach((slot) => {
      if (activeReqBySlot.current[slot] !== undefined) rollbackPane(slot)
      else flushSlot(slot)
    })
    return lastBroadcastContent.current
  }, [rollbackPane, flushSlot])

  /**
   * Abort a single pane (its own stop button). Returns that pane's text so its
   * follow-up input can restore it for editing. If this pane's request already
   * finished (it's just gliding its last bit of text in), there's nothing to
   * stop — flush it instantly instead of rolling back a completed answer.
   */
  const abortPane = useCallback(
    (slot: number): string => {
      if (activeReqBySlot.current[slot] === undefined) {
        flushSlot(slot)
        return ''
      }
      rollbackPane(slot)
      return lastUserContentBySlot.current[slot] ?? ''
    },
    [rollbackPane, flushSlot]
  )

  /** Begin streaming a response into a slot. `requestMessages` includes the new user turn. */
  const startStream = useCallback((slot: number, model: string, requestMessages: Message[]) => {
    const prev = activeReqBySlot.current[slot]
    if (prev) {
      api.chat.abort(prev)
      delete reqToSlot.current[prev]
    }

    delete pendingBySlot.current[slot]
    delete doneInfoBySlot.current[slot]

    const requestId = newRequestId()
    activeReqBySlot.current[slot] = requestId
    reqToSlot.current[requestId] = slot

    // Add the empty assistant placeholder that deltas fill in.
    setPanes((prev2) =>
      prev2.map((p) =>
        p.slot === slot
          ? { ...p, messages: [...p.messages, { role: 'assistant', content: '' }], status: 'streaming', error: undefined }
          : p
      )
    )

    api.chat.start({ requestId, model, messages: requestMessages })
  }, [])

  /* ── Layout ──────────────────────────────────────────────────────────── */
  const setLayout = useCallback(
    async (next: number) => {
      const lyt = clampLayout(next)
      const sid = sessionIdRef.current
      if (sid === null) return

      // Grow the pool with pre-filled panes if the new layout needs more.
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
   * Reorder the pane pool so the user-chosen models occupy the front slots,
   * then set the layout to show exactly those. `selectedSlots` are the slots to
   * keep visible; their current relative order is preserved. Everything else
   * (deselected panes, empties) keeps its data and moves to the hidden tail.
   *
   * Reassigning slots means the slot-keyed runtime maps must be remapped too, so
   * an in-flight stream keeps routing to its pane after the move. The new order
   * is persisted (slot drives ordering on reload).
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

      // oldSlot → newSlot (index in the reordered pool).
      const remap: Record<number, number> = {}
      ordered.forEach((p, index) => {
        remap[p.slot] = index
      })

      // Remap the slot-keyed runtime refs so streaming keeps working post-move.
      const remapKeys = <T>(rec: Record<number, T>): Record<number, T> => {
        const next: Record<number, T> = {}
        for (const key of Object.keys(rec)) next[remap[Number(key)]] = rec[Number(key)]
        return next
      }
      // Pause the reveal loop while we swap slots, then resume.
      if (revealFrame.current !== null) {
        cancelAnimationFrame(revealFrame.current)
        revealFrame.current = null
      }
      activeReqBySlot.current = remapKeys(activeReqBySlot.current)
      pendingBySlot.current = remapKeys(pendingBySlot.current)
      doneInfoBySlot.current = remapKeys(doneInfoBySlot.current)
      lastUserContentBySlot.current = remapKeys(lastUserContentBySlot.current)
      for (const reqId of Object.keys(reqToSlot.current)) {
        reqToSlot.current[reqId] = remap[reqToSlot.current[reqId]]
      }

      const newPanes = ordered.map((p, index) => ({ ...p, slot: index }))
      setPanes(newPanes)
      setLayoutState(targetLayout)
      if (Object.keys(pendingBySlot.current).length > 0) ensureRevealing()

      // Persist the new order + layout.
      const threadIds = newPanes.filter((p) => p.dbThreadId).map((p) => p.dbThreadId!)
      if (threadIds.length > 0) api.sessions.reorderThreads(threadIds)
      api.sessions.setLayout(sid, targetLayout)
    },
    [ensureRevealing]
  )

  /* ── Per-pane model selection ────────────────────────────────────────── */
  /**
   * Set (or change) a pane's model. CLEARS the pane's conversation — the caller
   * (UI) is responsible for confirming first if the pane already has messages.
   */
  const setPaneModel = useCallback((slot: number, modelId: string) => {
    const sid = sessionIdRef.current
    if (sid === null) return
    const pane = panesRef.current.find((p) => p.slot === slot)
    if (!pane) return
    const label = getModelDef(modelId).label

    // Stop any stream running in this pane.
    const active = activeReqBySlot.current[slot]
    if (active) api.chat.abort(active)

    if (pane.dbThreadId) {
      api.sessions.updateThreadModel(pane.dbThreadId, modelId, label)
      patchPane(slot, { modelId, label, messages: [], status: 'idle', error: undefined })
    } else {
      // Empty pane → create a thread row at this slot.
      api.sessions.addThread(sid, slot, modelId, label).then((dbThreadId) => {
        patchPane(slot, { modelId, label, messages: [], status: 'idle', error: undefined, dbThreadId })
      })
    }
    refreshSessions()
  }, [patchPane, refreshSessions])

  /* ── Sending messages ────────────────────────────────────────────────── */
  /** Broadcast to all VISIBLE panes that have a model. */
  const askAll = useCallback(
    (content: string) => {
      const sid = sessionIdRef.current
      if (!titleSet.current && sid !== null) {
        titleSet.current = true
        api.sessions.setTitle(sid, content).then(refreshSessions)
      }

      lastBroadcastContent.current = content
      const visible = panesRef.current.slice(0, layout).filter((p) => p.modelId)
      for (const pane of visible) {
        lastUserContentBySlot.current[pane.slot] = content
        const updated: Message[] = [...pane.messages, { role: 'user', content }]
        if (pane.dbThreadId) api.sessions.addMessage(pane.dbThreadId, 'user', content)
        patchPane(pane.slot, { messages: updated })
        startStream(pane.slot, pane.modelId!, updated)
      }
    },
    [layout, patchPane, startStream, refreshSessions]
  )

  /** Send to a single pane (its own follow-up input). */
  const askOne = useCallback(
    (slot: number, content: string) => {
      const pane = panesRef.current.find((p) => p.slot === slot)
      if (!pane?.modelId) return
      lastUserContentBySlot.current[slot] = content
      const updated: Message[] = [...pane.messages, { role: 'user', content }]
      if (pane.dbThreadId) api.sessions.addMessage(pane.dbThreadId, 'user', content)
      patchPane(slot, { messages: updated })
      startStream(slot, pane.modelId, updated)
    },
    [patchPane, startStream]
  )

  /* ── Session management ──────────────────────────────────────────────── */
  const newSession = useCallback(async () => {
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
  }, [cancelStreams, buildDefaultPanes, refreshSessions])

  const loadSession = useCallback(
    async (targetSessionId: number) => {
      if (targetSessionId === sessionIdRef.current) return
      cancelStreams()
      const data = await api.sessions.load(targetSessionId)
      titleSet.current = true
      setSessionId(data.sessionId)
      sessionIdRef.current = data.sessionId
      await applySessionData(data)
      refreshSessions()
    },
    [cancelStreams, applySessionData, refreshSessions]
  )

  const renameSession = useCallback(
    async (targetId: number, title: string) => {
      await api.sessions.setTitle(targetId, title)
      refreshSessions()
    },
    [refreshSessions]
  )

  const deleteSession = useCallback(
    async (targetId: number) => {
      await api.sessions.delete(targetId)
      if (targetId === sessionIdRef.current) {
        cancelStreams()
        titleSet.current = false
        const newId = await api.sessions.create()
        setSessionId(newId)
        sessionIdRef.current = newId
        const fresh = await buildDefaultPanes(newId, 0, 4)
        setPanes(fresh)
        setLayoutState(4)
      }
      refreshSessions()
    },
    [cancelStreams, buildDefaultPanes, refreshSessions]
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
