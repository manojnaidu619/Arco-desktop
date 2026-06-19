# 04 · Extending the App

Copy-paste recipes for the changes you'll make most often. Each one tells you
exactly which files to touch and in what order, so the structure stays clean.

> **The cardinal rule:** any new capability that needs files, the network, or
> secrets is implemented in `electron/` and exposed to the UI through
> `shared/api-contract.ts`. The UI never reaches around the bridge.

---

## Recipe 1 ⭐ — Add a new backend call (the core pattern)

Say you want the UI to fetch the list of *all* OpenRouter models. You're adding
one new `window.api` method. **Always four steps, always the same order:**

### Step 1 — Declare it in the contract

`shared/api-contract.ts`:

```ts
// add a channel name
settings: {
  // …existing…
  listAllModels: 'settings:listAllModels'
}

// add the method to the ArcoApi interface
settings: {
  // …existing…
  listAllModels(): Promise<string[]>
}
```

### Step 2 — Implement the logic in a service

Put real work in `electron/services/` (here, extend `openrouter.ts`):

```ts
export async function listAllModels(apiKey: string): Promise<string[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models', { headers: headers(apiKey) })
  const json = await res.json()
  return json.data.map((m: { id: string }) => m.id)
}
```

### Step 3 — Add the IPC handler (thin)

`electron/ipc/settings.ts`:

```ts
ipcMain.handle(CHANNELS.settings.listAllModels, () => {
  const key = secureStore.getKey()
  if (!key) return []
  return openrouter.listAllModels(key)
})
```

### Step 4 — Wire it in the bridge

`electron/preload.ts`, inside the `settings` object:

```ts
listAllModels: () => ipcRenderer.invoke(CHANNELS.settings.listAllModels),
```

**Done.** The UI can now call `api.settings.listAllModels()` and it's fully
typed. (If you forget step 3 or 4, TypeScript/the call will tell you.)

> For a **streaming** call instead of request/response, copy the pattern in
> `electron/ipc/chat.ts` or `electron/ipc/summary.ts` (use `ipcMain.on` +
> `sender.send` events, and `onX(cb)` subscriptions in preload) rather than
> `ipcMain.handle`.

---

## Recipe 2 — Add or change a curated model

Pure data, one file. Edit `CURATED_MODELS` in `shared/models.ts`:

```ts
{ id: 'openai/gpt-4o', label: 'GPT-4o', vendor: 'OpenAI', color: 'bg-green-500' },
```

`id` must be an exact OpenRouter model id. The new entry shows up as a checkbox
automatically — no other changes needed.

---

## Recipe 3 — Add a new persisted setting

Example: remember the user's preferred default models. Edit
`electron/services/settings-store.ts`:

```ts
interface Settings {
  customModels: string[]
  defaultModels: string[] // ← new
}
const DEFAULTS: Settings = { customModels: [], defaultModels: [] } // ← new

export function getDefaultModels(): string[] { return read().defaultModels }
export function setDefaultModels(ids: string[]): void {
  const s = read(); s.defaultModels = ids; write(s)
}
```

Then expose it to the UI with **Recipe 1** (contract → ipc/settings.ts →
preload). Non-secret prefs go in `settings.json`; **secrets go in
`secure-store.ts` instead** (Keychain).

---

## Recipe 4 — Add a database table or column (with migrations) ⭐

The schema evolves through **versioned Drizzle migrations** — the desktop
equivalent of web migration files. You edit the schema, generate a migration
file, and it applies itself on every user's machine at next launch. You never
hand-write `CREATE`/`ALTER` SQL.

1. **Edit the schema** in `electron/db/schema.ts` (the single source of
   truth):

   ```ts
   export const tags = sqliteTable('tags', {
     id: integer('id').primaryKey({ autoIncrement: true }),
     sessionId: integer('session_id').notNull().references(() => sessions.id, { onDelete: 'cascade' }),
     name: text('name').notNull()
   })
   ```

2. **Generate the migration:**

   ```bash
   npm run db:generate
   ```

   This diffs your schema against the last snapshot and writes a new file like
   `drizzle/0001_<name>.sql`. **Commit it.** Do not edit it (the one exception
   is the baseline `0000_init.sql`, intentionally made idempotent for the
   pre-migrations transition).

3. **That's it for applying it.** On the next launch, `electron/db/client.ts`
   runs `migrate()`, which applies any not-yet-applied migrations in order and
   records them in the `__drizzle_migrations` table. Shipping the app update
   ships the migration. (A backup is taken first; a failed migration is rolled
   back to it — see client.ts.)

4. **Add query functions** in a repository under
   `electron/db/repositories/` (e.g. `tags.repo.ts`). Keep all SQL here.

5. **Expose** whatever the UI needs via **Recipe 1**.

> **Never** add raw `CREATE TABLE`/`ALTER TABLE` to `client.ts` — that's the old
> approach we removed. Always go through `schema.ts` + `npm run db:generate`.

---

## Recipe 5 — Add a new UI screen or component

Pure renderer work — no backend involved unless you need data.

1. Create the component in `src/components/`. Compose existing primitives from
   `src/components/ui/` (Button, Input, …) and use `cn()` from `@/lib/utils`.
2. Need data? Call `api.*` (from `@/lib/api`) inside a `useEffect` or a custom
   hook in `src/hooks/`. **Never import `window.api` directly** — always go
   through `@/lib/api`.
3. Wire it into the layout in `src/components/MainApp.tsx`, or into the gate in
   `src/App.tsx` if it's a full-screen state (like onboarding).

Follow the existing components for styling conventions (Tailwind classes, theme
variables like `bg-muted`, `text-muted-foreground`).

---

## Recipe 6 — Add a native menu item / shortcut

Edit the template in `electron/window-menu.ts`. Most items use built-in
"roles". To run custom code (e.g. a "New Conversation" shortcut), send an event
to the window and have the UI react:

```ts
// in window-menu.ts
{ label: 'New Conversation', accelerator: 'CmdOrCtrl+N',
  click: (_i, win) => win?.webContents.send('menu:new-session') }
```

Then expose a subscription via the bridge (a small `onMenuCommand(cb)` on the
contract, wired like the `chat.onDelta` listener) and call your `useChat`
`newSession()` when it fires.

---

## Things to keep doing (so it stays clean)

- **Keep `ipc/` handlers thin.** Logic belongs in `services/`.
- **Keep SQL in repositories.** Components and IPC handlers never write SQL.
- **Route everything UI↔backend through `shared/api-contract.ts`.** It's what
  keeps the two halves type-safe and decoupled.
- **Secrets → Keychain (`secure-store.ts`); prefs → `settings.json`
  (`settings-store.ts`); conversation data → SQLite.**
- **Run `npm run typecheck`** after changes — it catches contract drift across
  all three bridge files.

## Things to avoid

- ❌ Importing Node modules (`fs`, `path`, `better-sqlite3`) in `src/`. The UI
  is sandboxed; it can't use them. Do that work in `electron/` and expose a
  method.
- ❌ Reading `window.api` directly in components — use `@/lib/api`.
- ❌ Putting business logic in `ipc/` handlers or components.
- ❌ Storing the API key anywhere but the Keychain (`secure-store.ts`).
