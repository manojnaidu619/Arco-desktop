# Arco Coding Standards

**Primary reference for this codebase.** AI agents and tools should read this file first — it is the minified version of [DOCUMENTATION.md](DOCUMENTATION.md), distilled to the rules, standards, and conventions you need to work here.

## For AI agents and tools

1. **Start here.** This file is the first and default source of truth. Follow it when creating, editing, or reviewing any `.ts` / `.tsx` file.
2. **Do not read all of DOCUMENTATION.md.** That file is the full reference. Loading it entirely bloats context without adding value for most tasks.
3. **Pull detail only when needed.** If a rule here is not enough, open [DOCUMENTATION.md](DOCUMENTATION.md) and read **only the specific section** listed in [More detail](#more-detail) below.

Mandatory conventions for all `.ts` / `.tsx` work. Human developers can use the same flow: standards first; open the full doc only when something is not clear.

## File header

Every source file opens with a block comment: purpose, where it fits (renderer / main / shared), and key constraints if any. End with the standard `@see` line (exact wording below).

```typescript
/**
 * [What this file does — 1–2 sentences]
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
```

## Exports (functions, components, hooks, types)

- JSDoc on all exported symbols
- Use `@param`, `@returns`; add `@used-by`, `@throws` when they help
- Complex logic: optional `Internal steps:` list (DOCUMENTATION.md §2 only if needed)

## Props and interface fields

- Document non-obvious fields; skip self-explanatory ones (`open: boolean`)

## Inline comments

- Add for non-obvious _why_ — security, streaming, layout, stale closures, edge cases
- Skip obvious narration and anything already in JSDoc
- Large files: section dividers (`// ── Session lifecycle ──`)

## Naming

- Booleans: `is*`, `has*`, `should*`, `can*`
- Handlers: `handle*` (internal), `on*` (props)
- Async names: `loadSession`, `streamChat`, `fetchData`
- Types `PascalCase`; functions/vars `camelCase`; constants `SCREAMING_SNAKE_CASE`

## Domain terms

Use Arco vocabulary, not generic SQL/array jargon:

- **session** — saved conversation
- **thread** — one model's messages in a session
- **pane** — UI grid slot (identity is the slot, not the model)
- **slot** — pane index; **layout** — visible pane count (1|2|3|4|6)
- **streaming / delta** — token-by-token OpenRouter response

## Avoid documenting

- Line-by-line narration, obvious imports, unstable file paths
- Build/config files unless behavior is non-obvious

## More detail

Use this table **only when something above is unclear** — e.g. you need a worked example or a walkthrough. Jump to the matching section in [DOCUMENTATION.md](DOCUMENTATION.md); do not read the whole document.

| Topic                                    | Read only |
| ---------------------------------------- | --------- |
| File header examples (simple vs complex) | §1        |
| JSDoc with `@example`, `Internal steps`  | §2        |
| Inline comment good/bad examples         | §4        |
| AI-oriented patterns                     | §7        |
