# 01 · Architecture

## What is Electron (in web terms)?

Your web app normally needs two things to run:

- a **browser** on the user's machine (runs your React/HTML/CSS), and
- a **server** in the cloud (runs your API, talks to the database).

**Electron bundles a private copy of both — Chromium (the browser engine) and
Node.js (the server runtime) — inside one downloadable app.** When the user
opens Multi-Mind:

- it opens its own Chromium window showing your React UI, and
- it runs its own Node.js process for the "backend" work,

…all on the user's Mac. Nothing of ours lives in the cloud. The only network
call that leaves the machine is the direct request to OpenRouter.

## The two processes (the core concept)

Every Electron app is split into two kinds of process:

| | **Main process** | **Renderer process** |
|---|---|---|
| Web analogy | Your backend server (Node.js) | Your frontend in a browser tab |
| Code lives in | `electron/` | `src/` + `index.html` |
| Can do | Everything: files, network, Keychain, SQLite, native modules | Only render UI |
| Cannot do | (n/a) | Touch the filesystem, secrets, or network directly |
| How many | Exactly one | One per window (we have one window) |

The renderer is **sandboxed** on purpose: it renders text that came from the
internet (model responses), so we treat it as untrusted and give it no direct
access to the user's machine. All the powerful, sensitive work happens in the
main process.

## How the two halves talk: IPC + the preload bridge

In a web app, the frontend calls the backend with `fetch('/api/...')` over
HTTP. Here there's no network in between — the two processes are on the same
machine — so they communicate over Electron's **IPC** (Inter-Process
Communication): an internal "phone line" between main and renderer.

We don't expose that phone line directly to the UI. Instead, a tiny script
called the **preload** publishes a small, explicit object — **`window.api`** —
onto the UI's `window`. The UI may call only the methods we put there.

```
  ┌─ src/ (UI) ─────────────┐        ┌─ electron/ (backend) ──────────┐
  │ api.sessions.list()     │        │ ipcMain.handle('sessions:list')│
  │ api.chat.start(...)     │        │ ipcMain.on('chat:start', ...)  │
  │ api.settings.saveKey()  │        │ ipcMain.handle('settings:...') │
  └───────────┬─────────────┘        └───────────────┬────────────────┘
              │  window.api  (defined in electron/preload.ts)          │
              └───────────────── IPC channels ───────────────────────┘
```

This indirection is the key to a clean, extensible app: **the UI doesn't know
*how* anything works.** It calls `api.sessions.list()` and gets data back — it
has no idea that's SQLite. You can rewrite the entire backend and never touch a
component.

### Two communication patterns

1. **Request → response** (most things). The UI calls a method and `await`s a
   result, exactly like `fetch`. Built on `ipcRenderer.invoke` ↔
   `ipcMain.handle`. Used for sessions and settings.

2. **Streaming** (chat only). A response that arrives gradually can't be a
   single return value. So the UI *starts* a request and then *listens* for a
   series of events: `delta` (more text), then `done` or `error`. Built on
   `ipcRenderer.send` + pushed events. See
   [03-data-flow.md](./03-data-flow.md) for the full trace.

## The contract that keeps both sides honest

Three files implement the bridge and must always agree. To keep them in sync,
the **types and channel names live in one shared file**:

- **`shared/api-contract.ts`** — defines the `window.api` shape (`MultiMindApi`)
  and the channel-name constants (`CHANNELS`). **The single source of truth.**
- **`electron/preload.ts`** — implements `window.api` by wiring each method to
  an IPC channel.
- **`electron/ipc/*.ts`** — the backend handlers listening on those channels.

Because all three import from `shared/api-contract.ts`, TypeScript will error
if they ever drift apart (e.g. you add a method to the contract but forget to
implement it).

## Where data physically lives

Nothing is in a cloud database. Everything is a file in the app's data folder:
`~/Library/Application Support/Multi-Mind/`.

| What | Where | How |
|---|---|---|
| Chat history | `multi-mind.db` | SQLite (better-sqlite3 + Drizzle) |
| API key | `credentials.bin` | Encrypted via macOS Keychain (`safeStorage`) |
| Custom model ids | `settings.json` | Plain JSON |

This folder is writable and survives app updates — unlike the app bundle in
`/Applications`, which is read-only (that's *why* the database can't live next
to the code like it did in the old web prototype).

### Keeping the schema up to date (migrations)

When you change the database schema, every existing user already has a database
on their machine with the *old* shape. We handle that with **versioned Drizzle
migrations** — the desktop version of "deploy runs the migrations":

- At dev time you edit `schema.ts` and run `npm run db:generate`, producing an
  ordered SQL file in `drizzle/` that ships inside the app.
- At startup the main process runs `migrate()`, which applies any migrations the
  user's database hasn't seen yet (tracked in a `__drizzle_migrations` table),
  each in a transaction — after taking a safety backup it can roll back to.

So updating the app updates each user's schema automatically and safely. Details
and the step-by-step are in [04-extending.md](./04-extending.md) (Recipe 4).

## Build & run pipeline

`electron-vite` builds three separate bundles (because each runs in a different
environment), and `electron-builder` packages them for distribution:

```
electron/main.ts     ──▶  out/main/index.js       (Node)
electron/preload.ts  ──▶  out/preload/index.js     (bridge)
index.html + src/    ──▶  out/renderer/...         (browser)
                                  │
                          electron-builder
                                  ▼
                         dist/Multi-Mind.dmg
```

- `npm run dev` — runs all three with hot-reload and opens the app.
- `npm run build` — produces the `out/` bundles.
- `npm run dist:mac` — builds + packages an (unsigned) `.dmg`.

Next: **[02-project-structure.md](./02-project-structure.md)** for what each
file does.
