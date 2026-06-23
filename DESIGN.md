# Design System

## 1. Purpose

This document is the single source of truth for all UI decisions in Arco. Every new screen, component, or visual change must be traceable back to the tokens, patterns, and rules defined here. When two implementations disagree, this document wins.

---

## 2. Design Principles

**Dark-first.** The logo, icon, and overall aesthetic are built around a dark surface. Light mode is fully supported but secondary. Always design and test in dark mode first.

**Token-only colors.** Never hard-code `hex`, `rgb`, or `hsl` values in components. Every color reference must use a CSS custom property from the token set.

**Minimal density.** The UI is compact — most text is `text-sm` (14 px) and icon buttons are 28 px. Add breathing room with consistent spacing multiples, not by increasing font sizes or padding arbitrarily.

**Understated copy.** UI text states facts, not feelings. No exclamation marks, no emoji, no filler words. See Section 10 for tone rules.

**Purposeful motion.** Animations communicate state transitions, not decoration. Every animation must justify its existence — if removing it doesn't confuse the user, remove it.

---

## 3. Foundations

### Colors

The app uses **OKLCH** color values throughout `src/index.css` via CSS custom properties, bridged into Tailwind v4 via the `@theme inline` block. The theme is **Cosmic Purple** — a blue-tinted neutral palette with an indigo/violet primary accent.

#### Semantic tokens

These tokens shift between light and dark mode. Always reference a token — never a raw value.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--background` | `oklch(0.9849 0.0029 264.5421)` | `oklch(0.1716 0.0097 255.6513)` | Page / window background |
| `--foreground` | `oklch(0.2795 0.0204 260.6090)` | `oklch(0.9203 0.0150 260.7292)` | Body text, icons |
| `--card` | `oklch(1 0 0)` | `oklch(0.2081 0.0153 261.6011)` | Card surfaces |
| `--card-foreground` | `oklch(0.2795 0.0204 260.6090)` | `oklch(0.9203 0.0150 260.7292)` | Text on cards |
| `--primary` | `oklch(0.5511 0.1602 284.9492)` | `oklch(0.6992 0.1399 284.9900)` | Brand indigo — buttons, active states, focus rings |
| `--primary-foreground` | `oklch(1 0 0)` | `oklch(0.1716 0.0097 255.6513)` | Text on primary |
| `--secondary` | `oklch(0.9409 0.0196 260.1696)` | `oklch(0.2995 0.0301 260.5101)` | Secondary buttons, quiet surfaces |
| `--secondary-foreground` | `oklch(0.3502 0.0408 259.8292)` | `oklch(0.8499 0.0498 259.7854)` | Text on secondary |
| `--muted` | `oklch(0.9642 0.0041 271.3692)` | `oklch(0.2501 0.0193 258.3593)` | Subtle backgrounds |
| `--muted-foreground` | `oklch(0.5011 0.0196 259.4168)` | `oklch(0.6999 0.0198 258.3637)` | Placeholder text, metadata, secondary labels |
| `--accent` | `oklch(0.9411 0.0190 248.0297)` | `oklch(0.2993 0.0296 248.8443)` | Hover backgrounds |
| `--accent-foreground` | `oklch(0.2795 0.0204 260.6090)` | `oklch(0.9203 0.0150 260.7292)` | Text on accent |
| `--destructive` | `oklch(0.6509 0.2199 25.0358)` | `oklch(0.6509 0.2199 25.0358)` | Errors, delete actions |
| `--border` | `oklch(0.9206 0.0092 258.3368)` | `oklch(0.2996 0.0161 259.7938)` | Dividers, pane gaps |
| `--input` | `oklch(0.9206 0.0092 258.3368)` | `oklch(0.2996 0.0161 259.7938)` | Input field borders |
| `--ring` | `oklch(0.5511 0.1602 284.9492)` | `oklch(0.6992 0.1399 284.9900)` | Focus rings |
| `--popover` | same as `--card` | same as `--card` | Dropdown / tooltip surfaces |
| `--popover-foreground` | same as `--card-foreground` | same as `--card-foreground` | Text on popovers |

#### Sidebar tokens

| Token | Light | Dark |
|---|---|---|
| `--sidebar` | `oklch(0.9695 0.0045 258.3246)` | `oklch(0.1993 0.0154 261.5830)` |
| `--sidebar-primary` | `oklch(0.5511 0.1602 284.9492)` | `oklch(0.6992 0.1399 284.9900)` |
| `--sidebar-primary-foreground` | `oklch(1 0 0)` | `oklch(0.1716 0.0097 255.6513)` |
| `--sidebar-accent` | `oklch(0.9411 0.0190 248.0297)` | `oklch(0.2993 0.0296 248.8443)` |
| `--sidebar-border` | `oklch(0.9206 0.0092 258.3368)` | `oklch(0.2996 0.0161 259.7938)` |

`--sidebar-primary` is intentionally the same indigo as `--primary` — active session highlights and primary buttons share the same brand color across the whole app.

#### Chart palette

| Token | Light | Dark |
|---|---|---|
| `--chart-1` | `oklch(0.5511 0.1602 284.9492)` — indigo | `oklch(0.6992 0.1399 284.9900)` |
| `--chart-2` | `oklch(0.6495 0.1408 250.4113)` — blue | `oklch(0.6507 0.1194 249.4864)` |
| `--chart-3` | `oklch(0.6351 0.1085 205.1732)` — teal | `oklch(0.7151 0.1216 201.6738)` |
| `--chart-4` | `oklch(0.6997 0.1503 159.8918)` — green | `oklch(0.6806 0.1206 159.6913)` |
| `--chart-5` | `oklch(0.6194 0.1996 20.0616)` — red | `oklch(0.6944 0.1966 19.6034)` |

---

### Typography

#### Font stack

Bundled via `@fontsource` — fully offline, no network request at runtime.

```css
--font-sans: Inter, sans-serif;
--font-mono: JetBrains Mono, monospace;
```

Imported in `src/index.css` (only the weights used in the UI):

```css
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/jetbrains-mono/400.css';
@import '@fontsource/jetbrains-mono/500.css';
```

#### Type scale

| Role | Tailwind classes | Size | Weight |
|---|---|---|---|
| Screen heading | `text-xl font-semibold` | 20 px | 600 |
| Section label | `text-sm font-medium` | 14 px | 500 |
| Body / most UI text | `text-sm` | 14 px | 400 |
| Caption / metadata | `text-xs` | 12 px | 400 |
| Uppercase label | `text-xs font-medium uppercase tracking-wider` | 12 px | 500 |
| Code / monospace | `font-mono text-sm` | 14 px | 400 |

**Rules:**
- Heading weight caps at `font-semibold` (600) — never `font-bold` in UI copy
- Secondary and supporting text uses `text-muted-foreground`
- `tracking-wider` is only for all-caps labels (e.g. section headings inside cards)
- `font-mono` for any rendered code, model IDs, or technical strings

---

### Spacing

**Base unit:** Tailwind's 4 px grid (`--spacing: 0.25rem`). All spacing values must be multiples of 4 px.

#### Key fixed dimensions

| Element | Value |
|---|---|
| Sidebar width | `260px` |
| Header height | `56px` (`h-14`) |
| Icon button — default | `32px × 32px` (`size-8`) |
| Icon button — small | `28px × 28px` (`size-7` / `h-7 w-7`) |
| Icon button — extra small | `24px × 24px` (`size-6`) |
| Standard button height | `32px` (`h-8`) |
| Input height | `32px` (`h-8`) |
| Onboarding card max width | `448px` (`max-w-md`) |
| Modal card max width | `384px` (`max-w-sm`) |
| Scrollbar width | `8px` |
| Model pane gap | `2px` (`gap-0.5`, rendered as `bg-border`) |

#### Padding conventions

| Context | Padding |
|---|---|
| Header bar | `px-3` |
| Chat / composer bar | `px-4 pb-3 pt-3` (or `pt-4` when the summary tab is visible) |
| Settings / dialog cards | `p-4` or `p-5` |
| Inline error banners | `px-3 py-2` |
| Sidebar footer | `px-2 py-2` |
| Session list inner padding | `py-2` |

---

### Radius

Base token: `--radius: 0.5rem` (8 px). All radii derive from this token.

| Token | Value | Used on |
|---|---|---|
| `--radius-sm` | `0.25rem` (4 px) | Small internal elements |
| `--radius-md` | `0.375rem` (6 px) | Inputs, small buttons |
| `--radius-lg` | `0.5rem` (8 px) | Buttons, cards, dialogs (default) |
| `--radius-xl` | `0.75rem` (12 px) | Larger cards, modal containers |
| `rounded-2xl` | `1rem` (16 px) | Onboarding icon container |
| `rounded-4xl` | pill | Badges |
| `rounded-full` | `9999px` | Scrollbar thumbs, circular elements |

---

### Shadows

Shadow tokens are defined in `src/index.css` as CSS custom properties. Use Tailwind's shadow utilities which map to these tokens.

| Token / Class | Value | Used on |
|---|---|---|
| `shadow-sm` | `0px 4px 10px …/0.12, 0px 1px 2px …/0.12` | Tabs, subtle elevation |
| `shadow-md` | `0px 4px 10px …/0.12, 0px 2px 4px …/0.12` | Slightly elevated surfaces |
| `shadow-lg` | `0px 4px 10px …/0.12, 0px 4px 6px …/0.12` | Moderate elevation |
| `shadow-xl` | `0px 4px 10px …/0.12, 0px 8px 10px …/0.12` | Dropdowns, popovers, modals, modal cards |
| `shadow-2xl` | `0px 4px 10px …/0.3` | Overlays (e.g. `SummaryOverlay`) |

Shadow opacity is lower in dark mode (dark variant uses lighter base color at reduced opacity). Always use shadow tokens — never write raw `box-shadow` values.

---

### Breakpoints

Arco is a **fixed-layout macOS desktop app**. There are no responsive layout breakpoints — the sidebar, header, and pane grid are fixed-width and do not reflow at different window sizes.

The only responsive utility present is `md:text-sm` on `Input` and `Textarea`, which is a Base UI convention for text rendering at different pixel densities and has no layout effect.

Do not introduce layout-altering breakpoints (`sm:`, `lg:`, `xl:` on structural elements) — this is not a web app.

---

## 4. Layout

### Page Structure

The root layout is a single horizontal flex container filling the entire screen:

```
<div class="flex h-screen bg-background text-foreground overflow-hidden">
  ├── Sidebar              w-[260px] shrink-0 flex flex-col h-full
  │   ├── Header           h-14 px-3 border-b border-border
  │   ├── Session list     flex-1 overflow-y-auto py-2
  │   └── Footer           px-2 py-2 border-t border-border
  └── Main area            flex flex-col flex-1 min-w-0 h-full
      ├── Header bar       h-14 px-3 border-b border-border shrink-0
      ├── Pane grid        flex-1 min-h-0 overflow-hidden
      └── Chat bar         shrink-0 border-t border-border px-4 pb-3 pt-3
```

### Grid Rules

Model panes are rendered as a CSS grid:

```html
<div class="grid gap-0.5 bg-border h-full w-full">
  <!-- one column per active model -->
</div>
```

- `gap-0.5` (2 px) between panes
- `bg-border` on the grid container — the background shows through the gap, making the gap *be* the border
- Column count equals the number of selected models; the grid recalculates automatically
- Pane appearance uses `animate-in fade-in-0 zoom-in-95 duration-200 ease-out`

### Responsive Rules

This app has no responsive layout. The window has a minimum size enforced by Electron; at or above that minimum everything is fixed-width.

- Never use breakpoint prefixes (`sm:`, `md:`, `lg:`) on layout-structural properties
- Window resize affects the width of the main area only — the sidebar width is always 260 px

---

## 5. Components

### Buttons

Built on `@base-ui/react/button` with `cva`. Base classes apply to all variants and sizes.

**Base (all variants):** `inline-flex items-center justify-center rounded-lg border border-transparent text-sm font-medium transition-all outline-none select-none`

#### Variants

| Variant | Resting | Hover |
|---|---|---|
| `default` | `bg-primary text-primary-foreground` | `bg-primary/80` |
| `outline` | `border-border bg-background` | `bg-muted text-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` | color-mix 5% foreground |
| `ghost` | transparent | `bg-muted text-foreground` |
| `destructive` | `bg-destructive/10 text-destructive` | `bg-destructive/20` |
| `link` | `text-primary` | underline |

#### Sizes

| Size | Height | Padding | Notes |
|---|---|---|---|
| `default` | `h-8` (32 px) | `px-2.5` | Standard action button |
| `sm` | `h-7` (28 px) | `px-2.5` | Compact button |
| `xs` | `h-6` (24 px) | `px-2` | Tight contexts |
| `lg` | `h-9` (36 px) | `px-2.5` | Prominent CTA |
| `icon` | `size-8` | — | Square icon button |
| `icon-sm` | `size-7` | — | Small icon button (most common in header) |
| `icon-xs` | `size-6` | — | Extra-small icon button |

**Primary CTA rule:** Use full-width (`w-full`) on onboarding and centered flows. Icon left of label only when there is a meaningful status (spinner, directional arrow). Never icon-only for primary actions.

---

### Inputs

Built on `@base-ui/react/input`. Single-line text input.

```
h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm
```

| State | Classes |
|---|---|
| Default | `border-input bg-transparent` |
| Focus | `border-ring ring-3 ring-ring/50` |
| Disabled | `bg-input/50 opacity-50 pointer-events-none cursor-not-allowed` |
| Error | `border-destructive ring-3 ring-destructive/20` (set `aria-invalid`) |
| Dark default | additionally `dark:bg-input/30` |

**Textarea:** Same token rules but `min-h-16 py-2 field-sizing-content` (auto-grows with content).

---

### Cards

Three card patterns, each for a specific context:

| Pattern | Classes | Used for |
|---|---|---|
| Inline card | `rounded-xl border border-border overflow-hidden` | Lists, settings rows, model entries |
| Content card | `rounded-xl border border-border bg-background p-5 shadow-xl` | Dialogs, onboarding steps, modal bodies |
| Section card | `rounded-lg border border-border p-4` | Settings sections, form groups |

Section label inside any card:

```
text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3
```

Feature icon container (onboarding / empty state):

```
h-14 w-14 rounded-2xl bg-primary/10
└── icon h-7 w-7 text-primary
```

---

### Navigation

The sidebar is the only persistent navigation surface.

```
flex flex-col h-full w-full bg-muted/30 border-r border-border
├── Header      h-14 px-3 border-b border-border  (logo + app name + new-session button)
├── Search      px-3 py-2 border-b border-border
├── Session list  flex-1 overflow-y-auto py-2
│   └── Session item  px-3 py-1.5 rounded-lg  (active: bg-sidebar-primary/10 text-sidebar-primary)
└── Footer      px-2 py-2 border-t border-border  (settings icon button)
```

**Rules:**
- Active session highlight uses `bg-sidebar-primary/10 text-sidebar-primary` (indigo tint, not a solid fill)
- Session list uses `overflow-y-auto` with an 8 px custom scrollbar styled with `rounded-full bg-muted-foreground/30`
- The sidebar can be toggled (collapsed) via `PanelLeftClose` / `PanelLeftOpen` buttons; animate collapse with `transition-all`

---

### Modals

Modals use a dark overlay (`bg-black/50`) with a centered content card:

```
w-full max-w-md rounded-xl border border-border bg-background shadow-xl flex flex-col max-h-[85vh]
```

For smaller confirmation dialogs:

```
w-full max-w-sm rounded-xl border border-border bg-background p-5 shadow-xl
```

**Rules:**
- Maximum height is `max-h-[85vh]` — always allow overflow-y scroll inside the modal body
- Close button (`X`) is always `size-7 ghost icon-sm` positioned top-right inside the modal header
- Modal header uses `border-b border-border px-4 py-3`
- Modal footer (actions) uses `border-t border-border px-4 py-3 flex gap-2 justify-end`

---

### Tables

Tables are not a current UI pattern in the app. If introduced, follow these rules:

- Full-width: `w-full text-sm`
- Header row: `text-xs font-medium text-muted-foreground uppercase tracking-wider border-b border-border`
- Body rows: `border-b border-border last:border-0` with `hover:bg-muted/50` on interactive rows
- Cells: `px-3 py-2`

---

### Feedback Components

#### Error banner

```
bg-destructive/10 rounded-lg px-3 py-2
├── AlertCircle  h-4 w-4 shrink-0 mt-0.5 text-destructive
└── <span>  text-xs text-destructive  (error message text)
```

#### Badge

Built on Base UI with `cva`. Base: `inline-flex h-5 rounded-4xl border px-2 text-xs font-medium`.

| Variant | Appearance |
|---|---|
| `default` | `bg-primary text-primary-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `destructive` | `bg-destructive/10 text-destructive` |
| `outline` | `border-border text-foreground` |
| `ghost` | hover-only background |

---

## 6. Interaction States

All interactive elements implement this full state set consistently:

| State | Visual |
|---|---|
| Default | Token-defined resting color |
| Hover | Background lightens or darkens by ~10–20% via `/80` opacity modifier or `bg-muted` |
| Focus (keyboard) | `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50` — 3 px indigo ring |
| Active / pressed | `active:translate-y-px` — 1 px downward nudge on click release |
| Disabled | `opacity-50 pointer-events-none` — no cursor change except on inputs (`cursor-not-allowed`) |
| Error | `aria-invalid` attribute triggers `border-destructive ring-3 ring-destructive/20` |
| Expanded (dropdown trigger) | `aria-expanded:bg-muted aria-expanded:text-foreground` |
| Loading | Replace button label/icon with `<Loader2 className="h-4 w-4 animate-spin" />` |

**Rules:**
- Focus rings use `focus-visible` — mouse users never see the ring; keyboard users always do
- Never suppress focus rings for aesthetic reasons
- The `aria-invalid` pattern is the only error styling mechanism — do not create custom error CSS classes
- Loading state disables the button (`disabled` prop), so disabled styles also apply

---

## 7. Forms and Validation

**Layout:** Stack fields vertically with `flex flex-col gap-4`. Labels sit above their control.

**Label:** `text-sm font-medium` — sentence case, no trailing colon.

**Helper text:** `text-xs text-muted-foreground mt-1` — shown below the field when guidance is useful at rest.

**Error message:** `text-xs text-destructive mt-1` — shown below the field on validation failure. Set `aria-invalid` on the control to trigger the error ring.

**Validation timing:** Validate on submit or on blur — not on every keystroke. Inline real-time validation is only appropriate for async checks (e.g. API key validation) where the round trip is the user's explicit action.

**Required fields:** Mark with `aria-required` — do not use asterisks in labels.

---

## 8. Empty, Loading, and Error States

Every data surface must handle all three states before shipping.

### Loading

```
flex h-full items-center justify-center gap-2 text-muted-foreground
├── Loader2  h-4 w-4 animate-spin
└── <span>  text-sm  "Restoring conversation…"  (or equivalent factual label)
```

Only `Loader2 animate-spin` — no other spinner pattern.

### Empty

```
flex h-full items-center justify-center
└── <p>  text-xs text-muted-foreground text-center px-3
```

Message must state the current condition factually ("Your conversations will appear here", "No results found"). No decorative illustrations. No calls to action unless there is a clear primary action available.

### Error

Use the **error banner** component (Section 5 → Feedback Components) for inline errors.

For errors that block the entire view (e.g. database load failure), use a centered layout matching the loading state but swap the spinner for an `AlertCircle h-5 w-5 text-destructive` and include a short factual description with a retry action if one is available.

---

## 9. Motion & Animation

The app uses `tw-animate-css` and Tailwind animate utilities.

| Pattern | Classes | Notes |
|---|---|---|
| Pane appearance | `animate-in fade-in-0 zoom-in-95 duration-200 ease-out` | Grid / layout changes |
| Summary overlay slide | CSS transition via `SUMMARY_OVERLAY_ANIM_MS` constant | See `SummaryOverlay.tsx` |
| Spinner | `animate-spin` on `Loader2` | Only loading indicator |
| Dropdown / popover open | `animate-in fade-in-0 zoom-in-95 duration-150 ease-out` | Floating content |

**Rules:**
- Micro-interactions: 150–200 ms
- Panel transitions: 250–300 ms max
- Easing: always `ease-out` (fast start, slow end) — feels snappy, not sluggish
- No decorative animations on static, non-interactive content
- No `animate-bounce`, `animate-pulse`, or attention-seeking animations in the app UI

---

## 10. Accessibility

**Focus management:** All interactive elements use `focus-visible:ring-3 focus-visible:ring-ring/50`. Never suppress focus rings for aesthetic reasons.

**Keyboard navigation:** All buttons, inputs, and interactive list items must be keyboard reachable and operable. Avoid `tabIndex={-1}` on focusable elements unless intentional (e.g. inside a composite widget).

**Color contrast:** The token system is designed to maintain contrast in both themes. Follow the token-only rule — hard-coded colors bypass this guarantee.

**Minimum touch targets:** Icon buttons use at least `size-7` (28 × 28 px). No interactive element should be smaller than 24 × 24 px.

**Icon-only buttons:** Must have a `title` attribute that describes the action (e.g. `title="New conversation"`). For screen readers, add `aria-label` if the `title` is insufficient.

**Error states:** Use `aria-invalid` on form controls instead of visual-only indicators. Pair with `aria-describedby` pointing to the error message element.

**Semantic HTML:** Use `<button>` (via Base UI) for interactive controls, `<input>` for text fields. Do not use `div` or `span` with click handlers.

---

## 11. Content and Microcopy

The app voice is **direct, understated, and technically honest** — it states what happened and implies what to do. It does not over-promise, add warmth-filler, or use emoji.

**Rules:**
- Sentence case everywhere — never title case in UI labels or button text
- Ellipsis (…) on in-progress states; no trailing period on labels or buttons
- No exclamation marks anywhere in the app UI
- Error messages state the cause, not the feeling ("Could not validate that key." not "Hmm, that didn't work!")
- Use `text-muted-foreground` for supporting / secondary copy — visually distinguish it from primary labels
- For marketing copy, a slightly warmer tone is acceptable but still precise and confident — not hype

---

## 12. Implementation Guidelines

1. **Token-only colors.** Never write `#hex`, `rgb()`, or `hsl()` in component classes. Always use a CSS custom property via a Tailwind utility (`bg-primary`, `text-muted-foreground`, etc.).

2. **Spacing multiples.** All padding, margin, and gap values must be multiples of 4 px. Use Tailwind spacing scale only (`p-2`, `gap-3`, `mt-4`, etc.).

3. **Test both themes.** Before shipping any UI change, verify in both dark and light mode. `theme-provider.tsx` controls the `dark` class on the root.

4. **Dark mode token rules.**
   - Secondary text: always `text-muted-foreground`, never a hard-coded gray
   - Borders: always `border-border`
   - Surfaces: `bg-background` or `bg-card` — never `bg-white` or `bg-black`
   - Semi-transparent borders in dark: `border-border/50` for subtler lines (e.g. pane separators within sections)

5. **Icon library.** Lucide React exclusively — never mix in Heroicons, Phosphor, or any other set. Standard size is `h-4 w-4`. Never override Lucide's default 1.5 px stroke width.

6. **Loading indicator.** Always `<Loader2 className="h-4 w-4 animate-spin" />`. No other spinner pattern.

7. **Font weight cap.** `font-semibold` (600) is the maximum weight for UI text. Never use `font-bold` (700) or heavier in the app.

8. **Font imports.** Only import Inter and JetBrains Mono weights that are actively used in the UI (currently 400, 500, 600 for Inter; 400, 500 for JetBrains Mono). Adding an unused weight increases bundle size for no gain.

9. **Tailwind v4 syntax.** The project uses Tailwind v4 — use `@theme inline` for token registration and CSS-first config. Do not use `tailwind.config.js` for design token overrides.

10. **No backwards-compatibility hacks.** Don't add shims, re-exports, or `_unused` prefixes for removed code. Delete it.

---

## 13. Do / Don't Examples

### Copy

| Do | Don't |
|---|---|
| "Restoring conversation…" | "Loading your amazing conversations!" |
| "Stop generating before switching conversations." | "Oops! You need to stop the AI first." |
| "Could not validate that key." | "Hmm, something went wrong 🤔" |
| "Get started" | "Let's go!" |
| "Validating…" | "Hang tight…" |
| "No conversations found" | "Nothing here yet!" |

### UI patterns

| Do | Don't |
|---|---|
| `text-muted-foreground` for secondary text | Hard-coded `text-gray-400` or `text-zinc-500` |
| `border-border` for all dividers | `border-gray-200` or `border-neutral-700` |
| `bg-background` / `bg-card` for surfaces | `bg-white` or `bg-black` |
| `focus-visible:ring-3 ring-ring/50` | `outline-none` with no focus replacement |
| `disabled:opacity-50` via component props | `cursor-not-allowed` without `opacity` reduction |
| `Loader2 animate-spin` for loading state | Custom spinner SVG or `animate-bounce` |
| `h-4 w-4` Lucide icon at default stroke | Overriding `strokeWidth` on any Lucide icon |
| `font-semibold` as the heaviest heading weight | `font-bold` or `font-extrabold` in the UI |

---

## 14. Changelog

| Date | Change |
|---|---|
| 2026-06-19 | Initial version — created from project design audit, replacing `docs/06-design-system.md` |
