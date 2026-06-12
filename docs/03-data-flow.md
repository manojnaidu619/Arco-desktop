# 03 · Data Flow (worked examples)

The best way to understand the architecture is to trace real actions through
it. Each trace shows the hop **UI → bridge → backend → back**. File references
are clickable in most editors.

Legend: 🖥️ = renderer (UI), 🌉 = preload bridge, ⚙️ = main process (backend).

---

## A. App launch & the onboarding gate

What happens between double-clicking the app and seeing a screen.

1. ⚙️ `electron/main.ts` runs: names the app, registers IPC handlers
   (`registerIpcHandlers()`), builds the menu, and opens the window.
2. 🖥️ The window loads `index.html` → `src/main.tsx` → renders `<App>`.
3. 🖥️ `src/App.tsx` mounts and asks: *is a key stored?*
   `api.settings.getKeyStatus()`.
4. 🌉 `preload.ts` forwards that to the `settings:getKeyStatus` channel.
5. ⚙️ `electron/ipc/settings.ts` handles it → calls `secureStore.hasKey()` →
   checks whether `credentials.bin` exists. Returns `{ hasKey }`.
6. 🖥️ Back in `App.tsx`:
   - `hasKey === false` → render **`Onboarding`**.
   - `hasKey === true` → render **`MainApp`** (which then restores the session,
     see trace C).

---

## B. Saving the API key (request → response)

The first-run flow, and a clean example of validate-then-store.

1. 🖥️ In `Onboarding.tsx`, the user pastes a key and clicks "Validate &
   continue" → `api.settings.saveKey(key)`.
2. 🌉 → channel `settings:saveKey`.
3. ⚙️ `electron/ipc/settings.ts`:
   - calls `validate(key)` → `services/openrouter.ts#validateKey`, which makes a
     real `GET /api/v1/key` (and `/credits`) request to OpenRouter.
   - **only if valid**, calls `secureStore.setKey(key)` →
     `services/secure-store.ts` encrypts it with `safeStorage` (macOS Keychain)
     and writes `credentials.bin`.
   - returns `{ ok: true, balance }` or `{ ok: false, error }`.
4. 🖥️ `Onboarding.tsx`:
   - on `ok`, shows the balance and a "Get started" button → calls
     `onComplete()` → `App.tsx` flips `hasKey` to `true` → `MainApp` renders.
   - on error, shows the message and lets the user retry.

> 🔒 Notice the decrypted key never returns to the UI — only a boolean + a
> balance. The renderer can *use* the key (by asking the backend to make calls)
> but can never *read* it.

---

## C. Restoring the session on open

How the sidebar and columns repopulate after launch.

1. 🖥️ `MainApp` calls `useChat()` (`src/hooks/useChat.ts`). On mount it runs
   `api.sessions.getCurrent()` and `api.sessions.list()` in parallel.
2. 🌉 → channels `sessions:getCurrent` / `sessions:list`.
3. ⚙️ `electron/ipc/sessions.ts` → `db/repositories/sessions.repo.ts`:
   - `getCurrentSession()` finds the active session (or creates one) and
     assembles its panes (threads, ordered by **slot**) + messages + the saved
     **layout** from SQLite.
   - `listSessions()` returns every session with its model dots for the sidebar.
4. 🖥️ `useChat` rebuilds the **pane pool** (`panes[i].slot === i`) and the
   `layout`. A brand-new session (no threads) is pre-filled with the default
   panes; otherwise panes restore as saved. `MainApp` renders a grid of
   `ModelPane`s (`panes.slice(0, layout)`).

---

## D. Sending a message to all models (streaming) ⭐

The most important flow. This is where the streaming pattern earns its keep.

### Kickoff

1. 🖥️ User types in `ChatBar.tsx` and hits Enter → `MainApp` calls
   `askAll(content)` in `useChat.ts`.
2. 🖥️ For each **visible pane that has a model** (`panes.slice(0, layout)`),
   `useChat`:
   - appends the user message to that pane's state,
   - persists it: `api.sessions.addMessage(threadId, 'user', content)`,
   - calls `startStream(slot, model, messages)`.
3. 🖥️ `startStream` generates a unique `requestId`, records
   `requestId → slot`, appends an **empty assistant placeholder** to the pane
   (status `streaming`), and fires
   `api.chat.start({ requestId, model, messages })`.
4. 🌉 → channel `chat:start` (fire-and-forget; nothing is awaited).

### The stream

5. ⚙️ `electron/ipc/chat.ts` receives `chat:start`:
   - reads the decrypted key (`secureStore.getKey()`),
   - creates an `AbortController` stored under `requestId`,
   - calls `services/openrouter.ts#streamChat`, which POSTs to OpenRouter with
     `stream: true` and parses the Server-Sent-Events response.
6. ⚙️ For every chunk of text, `streamChat` calls back, and `chat.ts` pushes a
   `chat:delta` event: `sender.send('chat:delta', { requestId, delta })`.
7. 🌉🖥️ `useChat`'s `api.chat.onDelta(...)` subscription fires. It looks up
   `requestId → slot` and appends the delta to that pane's last (assistant)
   message. **This is the live "typing" you see** — and because each pane has
   its own `requestId`, all panes (even duplicate models) stream concurrently.

### Finish

8. ⚙️ When the model is done, `chat.ts` sends `chat:done`
   `{ requestId, content }` (the full text), and removes the `AbortController`.
9. 🖥️ `useChat`'s `onDone` subscription persists the finished message
   (`api.sessions.addMessage(threadId, 'assistant', content)`), marks the
   thread `done`, and refreshes the sidebar.
10. ⚙️🖥️ On failure instead, `chat.ts` sends `chat:error { requestId, message }`;
    `useChat`'s `onError` removes the empty placeholder and shows the error in
    that column.

### Cancelling

- 🖥️ Switching/clearing sessions calls `abortAll()` → `api.chat.abort(requestId)`
  for each in-flight stream.
- ⚙️ `chat.ts` aborts the matching `AbortController`, which cancels the fetch.
  (A user-initiated abort is treated as expected — no error event is sent.)

```
🖥️ askAll ─▶ chat.start{requestId} ─▶ ⚙️ streamChat ─▶ OpenRouter
   ▲                                        │
   │  onDelta {requestId, delta}  (xN) ◀────┘  push as text arrives
   │  onDone  {requestId, content}        ◀──  push once at the end
   └─ append text to the matching column, then persist + mark done
```

---

## E. Adding a custom model

1. 🖥️ `ModelPicker.tsx` (via `useCustomModels.ts`) calls
   `api.settings.addCustomModel(id)`.
2. 🌉 → `settings:addCustomModel`.
3. ⚙️ `settings.ts` → `services/settings-store.ts` appends the id to
   `settings.json` and returns the updated list.
4. 🖥️ The picker shows it under "Your models", and it persists across restarts.

---

These five traces cover every pattern in the app. When adding a feature, find
the closest trace above and follow the same hops. Recipes for doing exactly
that are in **[04-extending.md](./04-extending.md)**.
