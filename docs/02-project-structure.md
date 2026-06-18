# 02 · Project Structure

A guided tour of the repo. The golden rule for keeping things tidy:

> **`electron/` is the backend. `src/` is the UI. `shared/` is what they both
> agree on. Code only ever crosses between `electron/` and `src/` through
> `shared/api-contract.ts`.**

## Top-level map

```
multi-mind-desktop/
├── electron/                 ← MAIN PROCESS ("the backend")
├── src/                      ← RENDERER ("the UI")
├── shared/                   ← types/contract shared by both
├── index.html                ← the UI's HTML entry (loads src/main.tsx)
├── docs/                     ← you are here
├── build/                    ← packaging assets (app icon, etc.)
│
├── electron.vite.config.ts   ← how the 3 bundles are built
├── electron-builder.yml      ← how the .dmg is packaged (unsigned for now)
├── tsconfig.json             ← references the two tsconfigs below
├── tsconfig.node.json        ← TS settings for electron/ + shared/
├── tsconfig.web.json         ← TS settings for src/ + shared/
└── package.json
```

## `electron/` — the backend

```
electron/
├── main.ts                   ← APP ENTRY: creates the window, app lifecycle
├── preload.ts                ← THE BRIDGE: defines window.api
├── window-menu.ts            ← native menu bar (Copy/Paste/Quit shortcuts…)
│
├── ipc/                      ← the "API endpoints" the UI can call
│   ├── index.ts              ←   registers all handlers (called from main.ts)
│   ├── sessions.ts           ←   conversation CRUD endpoints
│   ├── chat.ts               ←   streaming chat (start/abort + push events)
│   ├── summary.ts            ←   multi-model summarization (same streaming pattern)
│   └── settings.ts           ←   API-key + saved-model endpoints
│
├── services/                 ← stateless logic (no IPC knowledge)
│   ├── openrouter.ts         ←   talks to the OpenRouter API
│   ├── secure-store.ts       ←   encrypts/stores the key (Keychain)
│   └── settings-store.ts     ←   reads/writes settings.json
│
└── db/                       ← the database layer
    ├── client.ts             ←   opens the DB + runs migrations on startup
    ├── schema.ts             ←   table definitions (Drizzle) — source of truth
    └── repositories/
        └── sessions.repo.ts  ←   all SQL for sessions/threads/messages
```

The database schema evolves through **versioned migrations** (see Recipe 4 in
[04-extending.md](./04-extending.md)). Two project-root items support this:

```
drizzle/                      ← generated migration SQL (shipped with the app)
  ├── 0000_init.sql           ←   one file per schema change, applied in order
  └── meta/                   ←   drizzle-kit's snapshots + journal
drizzle.config.ts             ← drizzle-kit settings (dev-time only)
```

On launch, `client.ts` applies any pending migrations to the user's database and
records them in a `__drizzle_migrations` table — so updating the app updates each
user's schema automatically, with a safety backup first.

**The layering here matters** (and is the pattern to keep):

```
ipc/  →  services/ + db/  →  database / network
(thin)   (real logic)        (the outside world)
```

- **`ipc/` handlers are thin.** They receive a call from the UI and immediately
  delegate to a service or a db repository. No business logic, no SQL. Think
  "controller".
- **`services/` hold the real work** (OpenRouter, key storage, settings) and
  know nothing about IPC. **`db/`** owns the database (connection, schema,
  migrations, and the SQL repositories). Both are just normal functions — easy
  to test and reuse.

So a request flows: `UI → preload → ipc/ handler → service → DB/network`, and
the result flows back the same way.

## `src/` — the UI (Vite + React)

```
src/
├── main.tsx                  ← mounts React into #root, wraps in ThemeProvider
├── App.tsx                   ← top-level GATE: loading → onboarding → app
├── index.css                 ← Tailwind + theme variables (light/dark)
│
├── lib/
│   ├── api.ts                ← `export const api = window.api` (typed doorway)
│   └── utils.ts              ← cn() class-name helper
│
├── hooks/
│   ├── useChat.ts            ← all conversation state + streaming logic
│   └── useSavedModels.ts     ← the user's saved model library
│
└── components/
    ├── MainApp.tsx           ← main screen (sidebar + grid + composer + summary state)
    ├── Onboarding.tsx        ← first-run API-key screen
    ├── SettingsDialog.tsx    ← manage/remove key, view balance
    ├── Sidebar.tsx           ← session history list
    ├── LayoutSelector.tsx    ← the 1/2/3/4/6 grid-layout picker
    ├── ModelPane.tsx         ← one grid pane (dropdown + messages + follow-up)
    ├── ModelDropdown.tsx     ← per-pane model picker popover (curated + saved)
    ├── SummaryOverlay.tsx    ← slide-up summarization panel + SummaryTab handle
    ├── ChatBar.tsx           ← the shared "ask all" composer
    ├── MessageBubble.tsx     ← renders one message (Markdown for assistant)
    ├── ThemeToggle.tsx       ← light/dark/system switch
    ├── theme-provider.tsx    ← wraps the app in next-themes
    └── ui/                   ← low-level styled primitives (button, input…)
```

> **Mental model:** a **pane is a grid slot**, not a model. `MainApp` shows a
> grid of `ModelPane`s (1/2/3/4/6 of them per the `LayoutSelector`); each pane
> independently picks its model via `ModelDropdown`. The same model may appear
> in multiple panes. See [03-data-flow.md](./03-data-flow.md).

**How the UI is layered:**

- **`components/ui/`** — dumb, reusable styled primitives (Button, Input,
  Checkbox, Badge, Separator, Textarea). No app logic. Generated from shadcn.
- **`components/`** (the rest) — feature components that compose primitives and
  hold local UI state (what's expanded, what panel is open).
- **`hooks/`** — shared stateful logic. `useChat` is the brain: it owns the
  in-memory conversation and is the only thing that calls `api.chat.*` and
  `api.sessions.*`. Summarization state lives in `MainApp` and calls
  `api.summary.*` (ephemeral — not persisted to SQLite).
- **`lib/api.ts`** — the single import every component/hook uses to reach the
  backend. Nothing in `src/` should ever touch `window.api` directly; always go
  through `api` from here.

## `shared/` — the contract

```
shared/
├── api-contract.ts           ← window.api shape (MultiMindApi) + CHANNELS names
├── types.ts                  ← domain types: Message, SessionSummary, …
└── models.ts                 ← curated model list + getModelDef()
```

These files are imported by **both** `electron/` and `src/`. Keep them free of
Node-only and browser-only code — just plain types and data. This is the
boundary that lets the two halves stay in sync (and lets TypeScript catch
mismatches).

## Config files, briefly

| File | What it controls |
|---|---|
| `electron.vite.config.ts` | The 3 build bundles (main/preload/renderer), path aliases (`@/`, `@shared/`), React + Tailwind plugins. |
| `electron-builder.yml` | The `.dmg`/`.zip` output, native-module unpacking (`asarUnpack`), and (later) code-signing. |
| `tsconfig.node.json` | TypeScript for the backend half (Node globals). |
| `tsconfig.web.json` | TypeScript for the UI half (DOM + JSX globals). |
| `package.json` | Dependencies and the `dev` / `build` / `dist:mac` scripts. |

## Path aliases (so imports stay readable)

- `@/…`        → `src/…`     (used inside the UI)
- `@shared/…`  → `shared/…`  (used by both halves)

Configured in `electron.vite.config.ts` (for the bundler) and the two
`tsconfig.*.json` files (for the type-checker).

Next: **[03-data-flow.md](./03-data-flow.md)** to see these pieces work
together.
