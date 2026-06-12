# Multi-Mind (macOS desktop)

Ask one question, compare answers from multiple AI models side by side — as a
private, local-only macOS app. You bring your own OpenRouter API key; your key
and all conversation history live only on your Mac.

Built with **Electron + Vite + React + TypeScript**, with a local **SQLite**
database (better-sqlite3 + Drizzle).

## How it's structured

The app is two processes that talk over a typed bridge:

```
src/        → Renderer: the React UI (sandboxed; no file/network access)
              talks to the backend ONLY via window.api
electron/   → Main process: the "backend" — owns the DB, the network calls
              to OpenRouter, and the encrypted API key
shared/     → Types + the api-contract that both sides agree on
```

- **shared/api-contract.ts** — the single source of truth for `window.api`.
- **electron/preload.ts** — publishes `window.api` to the UI.
- **electron/ipc/** — backend handlers (sessions, chat streaming, settings).
- **electron/services/** — the real logic: OpenRouter client, SQLite
  repositories, Keychain (`safeStorage`) key storage, settings store.

### Where your data lives

- Conversations: `~/Library/Application Support/Multi-Mind/multi-mind.db`
- API key: encrypted via the macOS Keychain (`credentials.bin` in the same folder)
- Custom model ids: `settings.json` in the same folder

## Develop

```bash
npm install          # also rebuilds better-sqlite3 for Electron (postinstall)
npm run dev          # launches the app with hot-reload
npm run typecheck    # type-check both halves
```

### Changing the database schema

The schema evolves through versioned Drizzle migrations (applied automatically
on each user's machine at startup — see `docs/04-extending.md`, Recipe 4):

```bash
# 1. edit electron/db/schema.ts
npm run db:generate  # 2. writes a new file to drizzle/ — commit it
# 3. it applies itself on next launch (with a safety backup)
```

## Build a distributable

```bash
npm run dist:mac     # produces an unsigned .dmg + .zip in dist/
```

The build is **unsigned** for now (see `mac.identity: null` in
`electron-builder.yml`). On first open, right-click the app → Open to bypass the
macOS "unidentified developer" warning. To ship to the public later, get an
Apple Developer ID and add code-signing + notarization there — no other code
changes needed.
