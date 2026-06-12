/**
 * IPC handlers for streaming chat.
 *
 * Chat doesn't fit the simple request→response pattern, because the answer
 * arrives gradually. So we use a fire-and-forget message (`ipcMain.on`) plus
 * push events back to the UI:
 *
 *   UI  ──chat:start {requestId,…}──▶  main
 *   UI  ◀──chat:delta {requestId, delta}──  main   (many times)
 *   UI  ◀──chat:done  {requestId, content}─  main   (once, on success)
 *   UI  ◀──chat:error {requestId, message}─  main   (once, on failure)
 *   UI  ──chat:abort {requestId}──▶          main   (to cancel)
 *
 * Each in-flight request has an AbortController stored by requestId so the UI
 * can cancel a specific stream (e.g. when switching sessions) without
 * touching the others.
 */
import { ipcMain } from 'electron'
import { CHANNELS, type ChatStartRequest } from '@shared/api-contract'
import { streamChat } from '../services/openrouter'
import { getKey } from '../services/secure-store'

/** requestId → its AbortController, for cancellation. */
const activeRequests = new Map<string, AbortController>()

export function registerChatHandlers(): void {
  ipcMain.on(CHANNELS.chat.start, async (event, req: ChatStartRequest) => {
    const { requestId, model, messages } = req
    const sender = event.sender

    const apiKey = getKey()
    if (!apiKey) {
      sender.send(CHANNELS.chat.error, {
        requestId,
        message: 'No API key found. Add one in Settings.'
      })
      return
    }

    const controller = new AbortController()
    activeRequests.set(requestId, controller)

    try {
      const content = await streamChat(
        apiKey,
        model,
        messages,
        (delta) => {
          // Guard against sending to a window that's been closed mid-stream.
          if (!sender.isDestroyed()) sender.send(CHANNELS.chat.delta, { requestId, delta })
        },
        controller.signal
      )
      if (!sender.isDestroyed()) sender.send(CHANNELS.chat.done, { requestId, content })
    } catch (err) {
      // A user-initiated abort is expected, not an error — stay silent.
      if ((err as Error)?.name === 'AbortError') return
      if (!sender.isDestroyed()) {
        sender.send(CHANNELS.chat.error, {
          requestId,
          message: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    } finally {
      activeRequests.delete(requestId)
    }
  })

  ipcMain.on(CHANNELS.chat.abort, (_event, requestId: string) => {
    activeRequests.get(requestId)?.abort()
    activeRequests.delete(requestId)
  })
}
