# Arco — Developer Docs

These docs explain how the desktop app is built and how to extend it. They're
written for a **web developer who is new to desktop apps**, so they lean on
web concepts you already know (frontend/backend, HTTP, etc.) and map them to
how Electron does things.

## Read in this order

1. **[01-architecture.md](./01-architecture.md)** — The big picture. What
   Electron is, the "two processes" model, and how the UI talks to the
   backend. **Start here.**
2. **[02-project-structure.md](./02-project-structure.md)** — A guided tour of
   every folder and file, and which "half" of the app each belongs to.
3. **[03-data-flow.md](./03-data-flow.md)** — Step-by-step traces of real
   actions (sending a message, restoring a session, saving the API key,
   summarizing the latest pane replies) so you can see the pieces working
   together.
4. **[04-extending.md](./04-extending.md)** — Copy-paste recipes for the common
   changes you'll make: add a backend call, a model, a settings field, a DB
   table, a UI screen.
5. **[05-glossary.md](./05-glossary.md)** — Plain-language definitions of the
   desktop/Electron terms used throughout.

## The one-sentence summary

> The app is a **React UI** (the part you see) talking to a **Node.js backend**
> (database, network, secrets) over a small, typed bridge called
> **`window.api`** — all bundled into one app that runs entirely on the user's
> Mac.

## The one mental model to remember

```
   RENDERER (the UI)                     MAIN PROCESS (the backend)
   ┌────────────────────┐               ┌──────────────────────────────┐
   │  React components   │   window.api  │  OpenRouter calls            │
   │  (src/)             │ ────────────▶ │  SQLite database             │
   │                     │ ◀──────────── │  Encrypted API key (Keychain)│
   │  sandboxed: cannot  │   (IPC bridge)│  Full Node.js powers          │
   │  touch files/secrets│               │                              │
   └────────────────────┘               └──────────────────────────────┘
        src/ + index.html                      electron/
                         \                     /
                          shared/  (types both sides agree on)
```

If you remember only this: **the UI never touches files, the network, or
secrets directly. It always asks the backend via `window.api`.**
