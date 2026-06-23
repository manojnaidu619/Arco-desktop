# Arco Documentation Standards

_Quick rules → [STANDARDS.md](STANDARDS.md). This file has examples and detail._

This document defines the mandatory documentation standards for the Arco codebase. Every file, function, and significant code block must follow these conventions to ensure consistency and readability for both human developers and AI agents.

**When modifying any file, read [STANDARDS.md](STANDARDS.md) first.** Use this document for examples, templates, and edge cases.

---

## Table of Contents

1. [File-Level Docstrings](#1-file-level-docstrings)
2. [Function and Component Documentation](#2-function-and-component-documentation)
3. [Interface and Type Documentation](#3-interface-and-type-documentation)
4. [Inline Comments](#4-inline-comments)
5. [Naming Conventions](#5-naming-conventions)
6. [Domain Language](#6-domain-language)
7. [AI Agent Optimization](#7-ai-agent-optimization)
8. [What NOT to Document](#8-what-not-to-document)

---

## 1. File-Level Docstrings

Every `.ts` and `.tsx` file **must** begin with a block comment explaining:

- **Purpose**: What the file/module does
- **Architecture**: Where it fits in the system (renderer, main process, shared)
- **Key constraints**: Security boundaries, integration contracts, or important caveats

### Basic Format

```typescript
/**
 * [One-line summary of what this file does.]
 *
 * [Optional: 1-3 sentences explaining architecture, constraints, or key behavior.]
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
```

### Example: Simple Component

```typescript
/**
 * Renders a license activation badge in the sidebar header.
 *
 * Shows "Pro" when activated, otherwise displays an upgrade prompt that
 * opens the license modal on click.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
```

### Example: Complex Module

```typescript
/**
 * THE BRIDGE CONTRACT — the single source of truth for how the UI talks to
 * the backend.
 *
 * In a normal web app the frontend calls the backend with `fetch('/api/…')`.
 * In this desktop app there is no web server: the React UI (renderer) and the
 * Node backend (main process) run as two separate processes on the user's Mac
 * and talk over Electron's IPC ("inter-process communication") channel.
 *
 * To keep that safe and tidy we expose ONE typed object — `window.api` — to
 * the UI. The UI may call only the methods defined here; it can't reach the
 * filesystem, the database, or the user's API key directly.
 *
 * Three files implement this one contract, and they must always agree:
 *   • shared/api-contract.ts (this file) — the types + channel names
 *   • electron/preload.ts                — wires `window.api` to IPC
 *   • electron/ipc/*.ts                  — the backend handlers
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
```

### Example: With Operational Instructions

For files that maintainers frequently edit, include a "how to" box:

```typescript
/**
 * The curated list of models shown as quick-pick checkboxes in the UI.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ HOW TO ADD / CHANGE THE DEFAULT MODELS                              │
 * │ Edit the CURATED_MODELS array below. Each `id` must be a valid      │
 * │ OpenRouter model id (the exact string from openrouter.ai/models).   │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
```

---

## 2. Function and Component Documentation

All exported functions, React components, and hooks **must** have JSDoc blocks.

### Required JSDoc Tags

| Tag | When to Use |
|-----|-------------|
| `@param` | Every parameter — explain purpose, not just type |
| `@returns` | Non-void functions — describe the return value |
| `@used-by` | When call sites matter for understanding context |
| `@example` | Complex utilities that benefit from usage examples |
| `@throws` | Functions that can throw errors |
| `@see` | Related functions or external documentation |

### Basic Format

```typescript
/**
 * [One-line summary.]
 *
 * @used-by  [UI component or hook that calls this]
 * @param    [name] — [description]
 * @returns  [what it returns]
 */
```

### Example: Simple Function

```typescript
/**
 * Snap any number to the nearest valid layout preset (default 4).
 *
 * @param n — raw pane count (e.g. from persisted session data)
 * @returns nearest value from LAYOUTS
 */
function clampLayout(n: number): number {
  // ...
}
```

### Example: Function with Multiple Call Sites

```typescript
/**
 * Broadcast the same user message to every visible pane that has a model.
 *
 * @used-by  MainApp → ChatBar onSend
 * @param    content — user message text
 * @see      askOne — single-pane counterpart for per-pane follow-up inputs
 *
 * Internal steps:
 *  1. Auto-set session title on the first message of a new session.
 *  2. For each visible pane with a model: persist user message, patch UI, startStream.
 */
const askAll = useCallback((content: string) => {
  // ...
}, [])
```

### Example: Function with Example Usage

```typescript
/**
 * Resolve a model id to its display metadata.
 *
 * Falls back to a sensible derived label/vendor for ids that aren't in the
 * curated list (e.g. a custom id the user pasted). This means the UI can
 * render ANY model id gracefully.
 *
 * @example
 *   getModelDef('openai/gpt-4o')
 *   // → { id: 'openai/gpt-4o', label: 'gpt-4o', vendor: 'openai', color: 'bg-slate-500' }
 */
export function getModelDef(id: string): ModelDef {
  // ...
}
```

### Complex Multi-Step Functions

For functions with significant internal logic, document the steps:

```typescript
/**
 * Convert loaded SessionData from the backend into the live pane pool.
 *
 * @used-by  initial load useEffect, loadSession
 * @param    data — session payload from api.sessions.getCurrent / load
 *
 * Internal steps:
 *  1. Clamp layout to a valid LAYOUTS preset.
 *  2. If no threads exist, pre-fill default panes for slots [0, layout).
 *  3. Otherwise rebuild the pool from saved threads; poolSize is max(layout,
 *     highest saved slot + 1) so no slot with data is dropped.
 *  4. Set layout state to the clamped value.
 */
const applySessionData = useCallback(async (data: SessionData) => {
  // ...
}, [])
```

---

## 3. Interface and Type Documentation

All exported interfaces and types **must** have JSDoc on:
- The interface/type itself
- Non-obvious fields (anything that isn't self-explanatory from the name)

### Example: Fully Documented Interface

```typescript
interface Props {
  /** OpenRouter model ids to render. */
  models: string[]
  /** Optional section heading above the list. */
  heading?: string
  /** When true, rows show checkboxes and call onToggle. */
  selectable?: boolean
  /** Currently selected ids (selection mode only). */
  selected?: Set<string>
  /** Toggle a model in/out of the selection set. */
  onToggle?: (modelId: string) => void
  /** When set, rows show a delete button (management mode). */
  onRemove?: (modelId: string) => void
  /** Disable delete buttons (e.g. when only one model remains). */
  removeDisabled?: boolean
  /** Highlight the active pane model (dropdown mode). */
  activeModelId?: string | null
  /** Select a model (dropdown mode — no checkbox). */
  onSelect?: (modelId: string) => void
}
```

### Example: Domain Type

```typescript
/** One grid slot. `modelId === null` means an empty pane awaiting selection. */
export interface Pane {
  slot: number        // Zero-based index; also the pane's grid position (0 = top-left)
  modelId: string | null  // AI model assigned to this pane; null = empty, awaiting selection
  label: string       // Human-readable model name shown in the pane header
  messages: Message[] // Full conversation history for this pane, in chronological order
  status: ThreadStatus    // Current state: 'idle' | 'streaming' | 'done' | 'error'
  error?: string      // Error message displayed in the pane when status === 'error'
  dbThreadId?: number // Primary key of the thread row in SQLite; undefined for unsaved panes
}
```

---

## 4. Inline Comments

Inline comments are for **non-obvious logic only**. They explain **why**, not **what**.

### When to Add Inline Comments

- **Security boundaries**: Main process only, keychain storage, CSP
- **Complex algorithms**: Layout selection, streaming routing, slot remapping
- **Integration patterns**: Third-party library usage, animation timing
- **Edge cases**: Destroyed windows, malformed responses, React batching
- **Non-obvious decisions**: Why one approach was chosen over another

### Example: Security Comment

```typescript
webPreferences: {
  preload: join(__dirname, '../preload/index.js'),
  contextIsolation: true,  // UI and preload run in separate JS contexts
  nodeIntegration: false,  // UI cannot use Node APIs directly
  sandbox: false,          // preload bundles the bridge; safe with the two flags above
  devTools: isDev()
}
```

### Example: Complex Logic

```typescript
// A choice is only needed when REDUCING below the populated count (or
// re-clicking the current layout to swap which models show). Expanding
// (target > current layout) just reveals more panes in their existing
// order, so apply it immediately — same for any target with nothing to drop.
const needsSelection = panes.length > target && target <= value
```

### Example: Framework Quirk

```typescript
// Append delta directly; React 19 automatic batching keeps re-renders at 60fps.
setPanes((prev) =>
  prev.map((p) => {
    if (p.slot !== slot) return p
    // ...
  })
)
```

### Section Dividers

Use section dividers to organize large files:

```typescript
// ── Persisted state (drives re-renders) ─────────────────────────────────
const [sessionId, setSessionId] = useState<number | null>(null)
const [panes, setPanes] = useState<Pane[]>([])

// ── Always-fresh ref mirrors (for callbacks & async closures) ────────────
const panesRef = useRef<Pane[]>([])
panesRef.current = panes

// ── Streaming routing maps ────────────────────────────────────────────────
const reqToSlot = useRef<Record<string, number>>({})
```

---

## 5. Naming Conventions

### Functions and Variables

| Pattern | Convention | Examples |
|---------|------------|----------|
| Boolean functions | Start with `is`, `has`, `should`, `can` | `isSessionLimitReached`, `hasLatestExchange`, `canCreate` |
| Event handlers | Start with `handle` or `on` | `handleClick`, `onToggle`, `handleSubmit` |
| Async functions | Indicate asynchrony in name | `fetchData`, `loadSession`, `streamChat` |
| Callbacks | Prefix with `on` when passed as props | `onSend`, `onAbort`, `onSelectModel` |

### Types and Interfaces

| Pattern | Convention | Examples |
|---------|------------|----------|
| Types/Interfaces | `PascalCase` | `ModelDef`, `ArcoApi`, `SessionData` |
| Props interfaces | Named `Props` (local) or `ComponentNameProps` (exported) | `Props`, `ModelListProps` |
| Event payloads | Suffix with `Event` | `ChatDeltaEvent`, `ChatDoneEvent` |
| Result types | Suffix with `Result` | `KeyValidationResult`, `NewSessionResult` |

### Constants

| Pattern | Convention | Examples |
|---------|------------|----------|
| Configuration | `SCREAMING_SNAKE_CASE` | `CURATED_MODELS`, `ONBOARDING_MIN_MODELS` |
| Channels/Keys | `SCREAMING_SNAKE_CASE` | `CHANNELS` |
| Layout presets | Typed arrays | `LAYOUTS = [1, 2, 3, 4, 6] as const` |

---

## 6. Domain Language

Use product and domain terms, not just implementation details. This helps both humans and AI agents understand the business context.

### Arco Domain Terms

| Term | Meaning |
|------|---------|
| **Session** | A saved conversation (contains multiple threads) |
| **Thread** | One model's conversation within a session |
| **Pane** | A grid slot in the UI (not the model itself) |
| **Slot** | Zero-based index of a pane in the grid |
| **Layout** | Number of visible panes (1, 2, 3, 4, or 6) |
| **Streaming** | Token-by-token response from OpenRouter |
| **Delta** | A single chunk of streamed text |

### Examples

```typescript
// Good: Uses domain language
const visible = panes.slice(0, layout)

// Bad: Uses only technical terms
const visibleItems = array.slice(0, count)
```

```typescript
// Good: Domain-aware comment
// Expand layout → reveal more panes; shrink → just lower the visible count

// Bad: Technical-only comment
// If target > current, splice more items into the array
```

---

## 7. AI Agent Optimization

Since AI agents frequently read and modify this codebase, follow these practices:

### Explicit Relationships

Document connections between files when relevant:

```typescript
/**
 * Three files implement this one contract, and they must always agree:
 *   • shared/api-contract.ts (this file) — the types + channel names
 *   • electron/preload.ts                — wires `window.api` to IPC
 *   • electron/ipc/*.ts                  — the backend handlers
 */
```

### Structured JSDoc Tags

Use consistent JSDoc tags that AI can parse:

```typescript
/**
 * @param {string} content — user message text
 * @returns {Promise<void>}
 * @throws {Error} when session is not loaded
 * @used-by MainApp → ChatBar onSend
 * @see askOne — single-pane counterpart
 */
```

### Decision Documentation

Explain why alternatives were rejected:

```typescript
// We use double-rAF instead of a single timeout because Chrome needs two
// frames to ensure the overlay DOM is rendered before measuring dimensions.
// A single rAF or setTimeout(0) was unreliable during fast session switches.
```

### Common Mistakes

Document common mistakes in complex files:

```typescript
// Common mistakes to avoid:
//  ✗ Reading `panes` state inside a callback    → use `panesRef.current` instead
//  ✗ Reading `sessionId` state in async code   → use `sessionIdRef.current` instead
//  ✗ Calling setPanes with a full replacement  → use `patchPane(slot, patch)` instead
```

---

## 8. What NOT to Document

### Do NOT Add These Comments

```typescript
// Bad: Narrates the obvious
// Import React
import React from 'react'

// Bad: Describes what the code does (the code already shows this)
// Increment the counter
counter++

// Bad: Restates the function name
// This function creates a window
function createWindow() { }

// Bad: Restates the type
// String variable for the user's name
const userName: string = 'John'
```

### Do NOT Over-Document

- Simple getters/setters that are self-explanatory
- One-line utility functions with obvious names
- Re-exports (a one-line JSDoc is enough)
- Test files (unless testing complex scenarios)

### Do NOT Reference Unstable Paths

Avoid hardcoding file paths that may change:

```typescript
// Bad: References a specific file that might move
// See src/components/modals/settings/SettingsPanel.tsx for implementation

// Good: References by concept
// See the settings panel component for implementation details
```

---

## Summary Checklist

When creating or modifying a file:

- [ ] File has a docstring with purpose, architecture context, and `@see STANDARDS.md`
- [ ] All exported functions/components have JSDoc with `@param` and `@returns`
- [ ] All exported interfaces have field-level documentation
- [ ] Complex logic has inline comments explaining **why**
- [ ] Domain language is used (session, thread, pane, slot)
- [ ] Naming follows conventions (boolean prefixes, handler prefixes)
- [ ] No obvious/redundant comments
- [ ] Section dividers for large files

---

*Quick rules live in [STANDARDS.md](STANDARDS.md). Update both files when patterns evolve.*
