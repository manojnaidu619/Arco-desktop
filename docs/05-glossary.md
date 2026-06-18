# 05 · Glossary

Plain-language definitions of the desktop/Electron terms used in these docs and
the code. Skim this whenever a word is unfamiliar.

### Electron
A framework that bundles a web browser engine (**Chromium**) and a server
runtime (**Node.js**) into a single desktop app. Lets you build a Mac/Windows
app with the same web tech you already know.

### Main process
The "backend" of an Electron app. One per app. Runs in Node.js with full access
to the computer (files, network, the Keychain, native modules). Our main-process
code lives in `electron/`. It creates windows and owns the database, the API
key, and all OpenRouter calls.

### Renderer process
The "frontend" — a Chromium window showing your React UI. **Sandboxed**: it
cannot touch the filesystem, secrets, or the network directly. Our renderer code
is `src/` + `index.html`.

### IPC (Inter-Process Communication)
The messaging system Electron uses for the main process and renderer to talk,
since they're separate processes. It replaces the HTTP calls you'd use between a
web frontend and backend. Two styles we use:
- `invoke`/`handle` — request → response (returns a Promise).
- `send` + `.on` events — fire-and-forget + pushed events (used for chat and
  summary streaming).

### Preload (script)
A small script (`electron/preload.ts`) that runs in a privileged spot between
main and renderer. Its only job is to expose a safe, limited `window.api` to the
UI via the **context bridge**. The UI can call only what the preload exposes.

### `window.api` / the bridge
The single typed object the UI uses to talk to the backend (e.g.
`window.api.sessions.list()`). Defined by the contract in
`shared/api-contract.ts`, published by `preload.ts`, and handled by
`electron/ipc/*`. In `src/` we access it via `@/lib/api`.

### Context isolation
A security setting (on, in our app) that keeps the UI's JavaScript and the
preload's JavaScript in separate worlds, so a malicious script in the UI can't
tamper with the bridge. Paired with `nodeIntegration: false` (the UI gets no
Node access).

### Contract (api-contract)
`shared/api-contract.ts` — the TypeScript interface (`MultiMindApi`) and channel
names (`CHANNELS`) that both the UI and backend import, so they can't drift
apart. The "single source of truth" for the bridge.

### Service
A backend module in `electron/services/` that does real work (talk to
OpenRouter, read the DB, encrypt the key) and knows nothing about IPC. Called by
the thin handlers in `electron/ipc/`.

### Repository
A service that owns all the database queries for one area (e.g.
`sessions.repo.ts`). Keeps SQL in one place instead of scattered around.

### SQLite / better-sqlite3 / Drizzle
- **SQLite** — a database that's just a single file on disk. Perfect for a
  local-only app.
- **better-sqlite3** — the Node library that reads/writes that file. It's a
  *native module* (see below).
- **Drizzle** — a TypeScript query builder/ORM that gives us typed tables and
  queries on top of better-sqlite3.

### Migrations / drizzle-kit / `__drizzle_migrations`
- **Migration** — a versioned, ordered change to the database schema, stored as
  a `.sql` file in `drizzle/`. The desktop equivalent of web migration files.
- **drizzle-kit** — the dev-time CLI that *generates* a migration file by
  diffing your `schema.ts` against the last snapshot (`npm run db:generate`).
- **`migrate()`** — the runtime function (called once at startup in `client.ts`)
  that *applies* any not-yet-applied migrations to the user's database.
- **`__drizzle_migrations`** — a bookkeeping table inside the user's database
  that records which migrations have run, so each is applied exactly once.
- **Baseline migration** — the first migration (`0000_init.sql`), made
  idempotent (`CREATE TABLE IF NOT EXISTS`) so it applies cleanly to databases
  that existed before migrations were introduced. Only `0000` is special; later
  migrations are normal generated SQL.

### Native module
An npm package with compiled C/C++ code (like `better-sqlite3`), not just
JavaScript. It must be **rebuilt to match Electron's exact version** (its
"ABI"), which is what `electron-builder install-app-deps` /
`@electron/rebuild` does. It's also why we sometimes pin a specific Electron
version — the native binary has to be compatible.

### safeStorage / Keychain
`safeStorage` is Electron's API for encrypting data using an OS-managed key. On
macOS that key lives in the **Keychain** (the same secure vault Safari uses for
passwords). We use it to encrypt the OpenRouter API key (`secure-store.ts`).

### userData folder
The per-app writable folder Electron gives you:
`~/Library/Application Support/Multi-Mind/`. Our database, encrypted key, and
settings live here. (The app bundle in `/Applications` is read-only, so data
*can't* live next to the code.)

### Vite / electron-vite
- **Vite** — the fast build tool/dev server for the React UI.
- **electron-vite** — wraps Vite to build all three pieces (main, preload,
  renderer) together and run them with hot-reload (`npm run dev`).

### electron-builder
The tool that packages the built app into a distributable `.dmg`/`.zip`
(`npm run dist:mac`). Also handles code-signing/notarization later.

### asar / asarUnpack
**asar** is the compressed archive Electron packs your app's files into. Native
binaries (`.node` files) can't run from inside it, so we **asarUnpack** them
(see `electron-builder.yml`) to a real folder — otherwise the database fails to
load in the packaged app.

### Code signing / notarization
Apple's process for marking an app as from a trusted developer (needs a paid
Apple Developer account). Without it, macOS shows an "unidentified developer"
warning. We ship **unsigned** for now and add this before public distribution —
no code changes required, just config in `electron-builder.yml`.

### SSE (Server-Sent Events)
The streaming format OpenRouter uses for chat and summary: a sequence of
`data: {…}` lines ending in `data: [DONE]`. `services/openrouter.ts` parses
these into the text deltas we push to the UI.
