/**
 * THE SECURE BRIDGE.
 *
 * This script runs in a special context that sits between the Node main
 * process and the sandboxed React UI. Its only job is to publish a safe,
 * explicit `window.api` object the UI can call — implementing the contract in
 * shared/api-contract.ts. The UI gets exactly these methods and nothing more
 * (no `require`, no filesystem, no direct IPC).
 *
 * Request/response calls use `ipcRenderer.invoke` (returns a Promise).
 * Streaming uses `ipcRenderer.send` (fire-and-forget) plus `.on` listeners
 * for the pushed delta/done/error events.
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  CHANNELS,
  type ChatDeltaEvent,
  type ChatDoneEvent,
  type ChatErrorEvent,
  type MultiMindApi,
  type SummaryStartRequest
} from '@shared/api-contract'

/**
 * Subscribe to a pushed event channel. Returns an unsubscribe function so
 * React effects can clean up listeners and avoid leaks/duplicates.
 */
function subscribe<T>(channel: string, cb: (payload: T) => void): () => void {
  const listener = (_event: IpcRendererEvent, payload: T) => cb(payload)
  ipcRenderer.on(channel, listener)
  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: MultiMindApi = {
  sessions: {
    getCurrent: () => ipcRenderer.invoke(CHANNELS.sessions.getCurrent),
    list: () => ipcRenderer.invoke(CHANNELS.sessions.list),
    create: () => ipcRenderer.invoke(CHANNELS.sessions.create),
    load: (sessionId) => ipcRenderer.invoke(CHANNELS.sessions.load, sessionId),
    delete: (sessionId) => ipcRenderer.invoke(CHANNELS.sessions.delete, sessionId),
    setTitle: (sessionId, title) => ipcRenderer.invoke(CHANNELS.sessions.setTitle, sessionId, title),
    setLayout: (sessionId, layout) => ipcRenderer.invoke(CHANNELS.sessions.setLayout, sessionId, layout),
    addThread: (sessionId, slot, modelId, label) =>
      ipcRenderer.invoke(CHANNELS.sessions.addThread, sessionId, slot, modelId, label),
    updateThreadModel: (threadId, modelId, label) =>
      ipcRenderer.invoke(CHANNELS.sessions.updateThreadModel, threadId, modelId, label),
    deleteThread: (threadId) => ipcRenderer.invoke(CHANNELS.sessions.deleteThread, threadId),
    reorderThreads: (threadIds) => ipcRenderer.invoke(CHANNELS.sessions.reorderThreads, threadIds),
    addMessage: (threadId, role, content) =>
      ipcRenderer.invoke(CHANNELS.sessions.addMessage, threadId, role, content)
  },

  chat: {
    start: (req) => ipcRenderer.send(CHANNELS.chat.start, req),
    abort: (requestId) => ipcRenderer.send(CHANNELS.chat.abort, requestId),
    onDelta: (cb) => subscribe<ChatDeltaEvent>(CHANNELS.chat.delta, cb),
    onDone: (cb) => subscribe<ChatDoneEvent>(CHANNELS.chat.done, cb),
    onError: (cb) => subscribe<ChatErrorEvent>(CHANNELS.chat.error, cb)
  },

  summary: {
    start: (req: SummaryStartRequest) => ipcRenderer.send(CHANNELS.summary.start, req),
    abort: (requestId: string) => ipcRenderer.send(CHANNELS.summary.abort, requestId),
    onDelta: (cb) => subscribe<ChatDeltaEvent>(CHANNELS.summary.delta, cb),
    onDone: (cb) => subscribe<ChatDoneEvent>(CHANNELS.summary.done, cb),
    onError: (cb) => subscribe<ChatErrorEvent>(CHANNELS.summary.error, cb)
  },

  settings: {
    getKeyStatus: () => ipcRenderer.invoke(CHANNELS.settings.getKeyStatus),
    validateKey: (key) => ipcRenderer.invoke(CHANNELS.settings.validateKey, key),
    saveKey: (key) => ipcRenderer.invoke(CHANNELS.settings.saveKey, key),
    clearKey: () => ipcRenderer.invoke(CHANNELS.settings.clearKey),
    getBalance: () => ipcRenderer.invoke(CHANNELS.settings.getBalance),
    getSavedModels: () => ipcRenderer.invoke(CHANNELS.settings.getSavedModels),
    setSavedModels: (modelIds) => ipcRenderer.invoke(CHANNELS.settings.setSavedModels, modelIds),
    addSavedModel: (modelId) => ipcRenderer.invoke(CHANNELS.settings.addSavedModel, modelId),
    removeSavedModel: (modelId) => ipcRenderer.invoke(CHANNELS.settings.removeSavedModel, modelId),
    validateModel: (modelId) => ipcRenderer.invoke(CHANNELS.settings.validateModel, modelId),
    isOnboardingCompleted: () => ipcRenderer.invoke(CHANNELS.settings.isOnboardingCompleted),
    completeOnboarding: () => ipcRenderer.invoke(CHANNELS.settings.completeOnboarding)
  }
}

// Publish the API onto `window.api` in the renderer. This is the ONLY thing
// the UI can see from the backend.
contextBridge.exposeInMainWorld('api', api)
