# Arco Design System

**Single source of truth for all visual decisions** — the app, landing page, marketing materials, press kit, and any other surface where Arco appears. When something looks or sounds like Arco, it should be traceable back to this document.

---

## 1. Brand Identity

### Name & handles

| Context | Use |
|---|---|
| Product / app name | **Arco** |
| Website | **arco.chat** |
| Social handles | **@arcochat** |
| Email | **hello@arco.chat** |
| Press / PR copy | **Arco (arco.chat)** |
| App Store / dock / title bar | **Arco** |

**Rules:**
- Always **Arco** — never "ArcoChat", "Arco Chat", or "ARCO"
- The `.chat` TLD carries the descriptive weight; don't append "Chat" to the product name
- Use **arco.chat** when directing someone to download or learn more; use **Arco** when talking about the product in copy

### Tagline

> _One question. Every model._

Use this exact phrasing on hero sections, App Store descriptions, and press releases. It is short enough to fit anywhere and covers both core differentiators (single input, multi-model output) in five words.

### Value propositions (for copy)

- **BYOK** — Bring your own OpenRouter key. No platform fee, no markup.
- **Private by design** — Conversations live on your Mac, not our servers.
- **Model-agnostic** — Any model on OpenRouter, not a curated shortlist.
- **Side-by-side comparison** — One prompt, multiple answers, instant comparison.
- **Mac-native** — Built as a proper macOS desktop app, not a web wrapper.

---

## 2. Logo & App Icon

### Icon description

Deep midnight-blue squircle (macOS rounded-corner square) containing multiple concentric glowing arcs that fan outward from a lower-left origin point. The arcs graduate in color from electric cyan (innermost) through indigo to violet (outermost), with a soft ambient glow against the dark background. The mark reads at any size from 16 px to 1024 px without text.

### Icon files

All files live in `build/` at the project root (configured in `electron-builder.yml` as `buildResources: build`):

| File | Size | Purpose |
|---|---|---|
| `build/icon.icns` | Multi-resolution | macOS dock, Finder, title bar |
| `build/icon.ico` | Multi-resolution | Windows taskbar (future) |
| `build/icon.png` | 1024 × 1024 px | Fallback, DMG window, marketing |

The source PNG must be **exactly 1024 × 1024 px**. Convert to `.icns` with:

```bash
sips -z 1024 1024 icon.png --out icon-1024.png
```

Then use Image2icon or `iconutil` to produce the `.icns` bundle.

### Icon usage rules

- Never place the icon on a light or white background — it requires a dark surface to read correctly
- Never crop, rotate, recolor, or add drop shadows to the icon itself
- Minimum display size: 16 × 16 px (macOS menu bar)
- For marketing, prefer the 1024 px PNG at 2× resolution for Retina

---

## 3. Color

The app uses **OKLCH** color values throughout `src/index.css` via CSS custom properties, bridged into Tailwind v4 through the `@theme inline` block. The theme is **Cosmic Purple** — a blue-tinted neutral palette with an indigo/violet primary accent consistent with the logo. This is the authoritative token set.

### Semantic tokens

These tokens shift between light and dark mode. Never hard-code hex/rgb values — always reference a token.

| Token | Light mode | Dark mode | Usage |
|---|---|---|---|
| `--background` | `oklch(0.9849 0.0029 264.5421)` | `oklch(0.1716 0.0097 255.6513)` | Page / window background |
| `--foreground` | `oklch(0.2795 0.0204 260.6090)` | `oklch(0.9203 0.0150 260.7292)` | Body text, icons |
| `--card` | `oklch(1 0 0)` | `oklch(0.2081 0.0153 261.6011)` | Card surfaces |
| `--card-foreground` | `oklch(0.2795 0.0204 260.6090)` | `oklch(0.9203 0.0150 260.7292)` | Text on cards |
| `--primary` | `oklch(0.5511 0.1602 284.9492)` | `oklch(0.6992 0.1399 284.9900)` | **Brand indigo** — buttons, active states, focus |
| `--primary-foreground` | `oklch(1 0 0)` | `oklch(0.1716 0.0097 255.6513)` | Text on primary |
| `--secondary` | `oklch(0.9409 0.0196 260.1696)` | `oklch(0.2995 0.0301 260.5101)` | Secondary buttons, quiet surfaces |
| `--secondary-foreground` | `oklch(0.3502 0.0408 259.8292)` | `oklch(0.8499 0.0498 259.7854)` | Text on secondary |
| `--muted` | `oklch(0.9642 0.0041 271.3692)` | `oklch(0.2501 0.0193 258.3593)` | Subtle backgrounds |
| `--muted-foreground` | `oklch(0.5011 0.0196 259.4168)` | `oklch(0.6999 0.0198 258.3637)` | Placeholder text, metadata |
| `--accent` | `oklch(0.9411 0.0190 248.0297)` | `oklch(0.2993 0.0296 248.8443)` | Hover states |
| `--accent-foreground` | `oklch(0.2795 0.0204 260.6090)` | `oklch(0.9203 0.0150 260.7292)` | Text on accent |
| `--destructive` | `oklch(0.6509 0.2199 25.0358)` | `oklch(0.6509 0.2199 25.0358)` | Errors, delete actions |
| `--border` | `oklch(0.9206 0.0092 258.3368)` | `oklch(0.2996 0.0161 259.7938)` | Dividers, pane gaps |
| `--input` | `oklch(0.9206 0.0092 258.3368)` | `oklch(0.2996 0.0161 259.7938)` | Input field borders |
| `--ring` | `oklch(0.5511 0.1602 284.9492)` | `oklch(0.6992 0.1399 284.9900)` | Focus rings |

### Sidebar tokens

| Token | Light mode | Dark mode |
|---|---|---|
| `--sidebar` | `oklch(0.9695 0.0045 258.3246)` | `oklch(0.1993 0.0154 261.5830)` |
| `--sidebar-primary` | `oklch(0.5511 0.1602 284.9492)` | `oklch(0.6992 0.1399 284.9900)` |
| `--sidebar-primary-foreground` | `oklch(1 0 0)` | `oklch(0.1716 0.0097 255.6513)` |
| `--sidebar-accent` | `oklch(0.9411 0.0190 248.0297)` | `oklch(0.2993 0.0296 248.8443)` |
| `--sidebar-border` | `oklch(0.9206 0.0092 258.3368)` | `oklch(0.2996 0.0161 259.7938)` |

`--sidebar-primary` shares the same indigo value as `--primary` — the active session highlight and primary buttons are now the same brand color across the whole app.

### Chart palette

| Token | Light | Dark |
|---|---|---|
| `--chart-1` | `oklch(0.5511 0.1602 284.9492)` — indigo | `oklch(0.6992 0.1399 284.9900)` |
| `--chart-2` | `oklch(0.6495 0.1408 250.4113)` — blue | `oklch(0.6507 0.1194 249.4864)` |
| `--chart-3` | `oklch(0.6351 0.1085 205.1732)` — teal | `oklch(0.7151 0.1216 201.6738)` |
| `--chart-4` | `oklch(0.6997 0.1503 159.8918)` — green | `oklch(0.6806 0.1206 159.6913)` |
| `--chart-5` | `oklch(0.6194 0.1996 20.0616)` — red | `oklch(0.6944 0.1966 19.6034)` |

### Pane gap color

The grid gap between model panes is rendered as `bg-border` (`--border`). This is intentional — thin lines of the border color, not a neutral gray gap — preserving contrast in both themes.

---

## 4. Typography

### Font stack

The app uses **bundled web fonts** via `@fontsource` npm packages — fully offline, no network request at runtime.

```css
--font-sans: Inter, sans-serif;
--font-serif: Georgia, serif;
--font-mono: JetBrains Mono, monospace;
```

Fonts are imported at the top of `src/index.css`:

```css
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/jetbrains-mono/400.css';
@import '@fontsource/jetbrains-mono/500.css';
```

Only the weights actually used in the UI are imported (400, 500, 600) to keep the bundle lean.

For the landing page and marketing materials, use **Inter** (same family). For design tools, use Inter from Google Fonts or the local install.

### Type scale (Tailwind classes used in the app)

| Role | Class | Size | Weight |
|---|---|---|---|
| Screen heading | `text-xl font-semibold` | 20 px | 600 |
| Section label | `text-sm font-medium` | 14 px | 500 |
| Body / most UI text | `text-sm` | 14 px | 400 |
| Caption / metadata | `text-xs` | 12 px | 400 |
| Uppercase label | `text-xs font-medium uppercase tracking-wider` | 12 px | 500 |

**Rules:**
- Heading weight tops out at `font-semibold` (600) — never `font-bold` in UI copy
- `text-muted-foreground` for all secondary / supporting text
- `tracking-wider` only on all-caps labels (e.g. section headings inside cards)

---

## 5. Spacing & Layout

### Base unit

Tailwind's default 4 px grid (`--spacing: 0.25rem`). All spacing values in the app are multiples of 4 px.

### Key fixed dimensions

| Element | Value |
|---|---|
| Sidebar width | `260px` |
| Header height | `56px` (h-14) |
| Icon button (small) | `28px × 28px` (h-7 w-7) |
| Onboarding card max width | `448px` (max-w-md) |
| Scrollbar width | `8px` |
| Model pane gap | `0.5` (2 px, rendered as `bg-border`) |

### Padding conventions

| Context | Padding |
|---|---|
| Header bar | `px-3` |
| Composer / chat bar | `px-4 pb-3 pt-3` (pt-4 when summary tab visible) |
| Settings / dialog cards | `p-4` |
| Inline error banners | `px-3 py-2` |

---

## 6. Border Radius

Base token: `--radius: 0.5rem` (8 px). All radii derive from this.

| Token | Value | Used on |
|---|---|---|
| `--radius-sm` | `0.25rem` (4 px) | Badges, tags |
| `--radius-md` | `0.375rem` (6 px) | Inputs, small buttons |
| `--radius-lg` | `0.5rem` (8 px) | Cards, dialogs (default) |
| `--radius-xl` | `0.75rem` (12 px) | Larger cards |
| Tailwind `rounded-xl` | `0.75rem` (12 px) | Model list containers, inline cards |
| Tailwind `rounded-2xl` | `1rem` (16 px) | Onboarding icon container |
| Tailwind `rounded-full` | `9999px` | Scrollbar thumbs, circular elements |

---

## 7. Iconography

**Library: [Lucide React](https://lucide.dev)**

All icons in the app come from Lucide. Use Lucide exclusively — do not mix in other icon sets.

### Size conventions

| Context | Size class |
|---|---|
| Standard UI icon | `h-4 w-4` (16 px) |
| Small button icon | `h-4 w-4` inside `h-7 w-7` button |
| Feature icon in onboarding | `h-7 w-7` (28 px) inside `h-14 w-14` container |
| Tiny inline icon | `h-3 w-3` (12 px) — e.g. external link |

### Stroke weight

Lucide defaults (1.5 px stroke). Never override stroke width.

### Loading state

Always use `<Loader2 className="h-4 w-4 animate-spin" />` — no other spinner pattern.

---

## 8. Component Patterns

These are the UI patterns used in the app. Apply consistently across new screens and marketing mockups.

### Error banner

```
bg-destructive/10  rounded-lg  px-3 py-2
└── AlertCircle icon (h-4 w-4 shrink-0 mt-0.5, text-destructive)
└── <span> error message (text-xs, text-destructive)
```

### Loading / empty state

Centered in the available space with `flex items-center justify-center gap-2 text-muted-foreground`.

### Feature icon container (onboarding / marketing)

```
h-14 w-14  rounded-2xl  bg-primary/10
└── icon  h-7 w-7  text-primary
```

### Inline card

```
rounded-xl  border border-border  overflow-hidden
```

### Section label inside a card

```
text-xs  font-medium  text-muted-foreground  uppercase  tracking-wider  mb-3
```

### Primary CTA button

Full-width (`w-full`) on onboarding / centered flows. Icon left of label only when there's a meaningful status (loading spinner, directional arrow). Never icon-only for primary actions.

---

## 9. Motion & Animation

The app uses `tw-animate-css` and Tailwind animate utilities.

| Pattern | Classes | Notes |
|---|---|---|
| Grid / pane appearance | `animate-in fade-in-0 zoom-in-95 duration-200 ease-out` | Used on layout changes |
| Summary overlay slide | CSS transition, `SUMMARY_OVERLAY_ANIM_MS` constant | See `SummaryOverlay.tsx` |
| Spinner | `animate-spin` on `Loader2` | Only loading state |

**Rules:**
- Keep durations short: 150–200 ms for micro-interactions, 250–300 ms max for panel transitions
- Prefer `ease-out` (fast start, slow end) — feels snappy, not sluggish
- No decorative animations on static content

---

## 10. Tone of Voice

The app copy is direct, understated, and technically honest — it does not over-promise.

| Do | Don't |
|---|---|
| "Restoring session…" | "Loading your amazing conversations!" |
| "Stop generating before switching sessions." | "Oops! You need to stop the AI first." |
| "Could not validate that key." | "Hmm, something went wrong 🤔" |
| "Get started" | "Let's go!" |
| "Validating…" | "Hang tight…" |

**Rules:**
- Sentence case everywhere — never title case in UI labels
- Ellipsis (…) on in-progress states; no trailing period on labels or buttons
- No exclamation marks in the app UI
- Error messages state what happened and imply what to do — no blame, no fluff
- For marketing copy, a slightly warmer tone is acceptable, but still precise and confident — not hype

---

## 11. Dark Mode

The app ships in both light and dark mode, controlled by the `dark` class on the root (via `theme-provider.tsx`).

**Default**: dark mode is the primary experience — the logo, icon, and overall aesthetic are designed around a dark surface. Light mode is fully supported but secondary.

**Rules for new UI surfaces:**
- Always test in both modes before shipping
- Use `text-muted-foreground` for secondary text — never a hard-coded gray
- Borders: always `border-border` — this token is semi-transparent in dark mode (`oklch(1 0 0 / 10%)`) which gives a subtler look than a solid color
- Never use `bg-white` or `bg-black` directly — use `bg-background` / `bg-card`

---

## 12. Marketing & PR Surfaces

Apply all of the above to landing page, screenshots, App Store assets, and press materials. Additional notes:

- **Screenshots for App Store / press**: always capture in dark mode; show the multi-pane comparison grid as the hero shot — it is the product's defining UI
- **Hero copy**: lead with the tagline ("One question. Every model.") then follow with a one-sentence expansion ("Send a single prompt to multiple AI models and compare their answers side by side — no subscription, your data stays on your Mac.")
- **Background for marketing graphics**: use the icon's deep midnight blue (`oklch(0.08 0.02 264)`) or near-black `oklch(0.145 0 0)` — not pure black
- **Accent color in marketing**: use the sidebar indigo (`oklch(0.488 0.243 264.376)`) for highlights, underlines, or call-to-action elements — keep it the only non-neutral color on the page
- **Font in design tools**: Inter (Regular 400, Medium 500, SemiBold 600) as the closest match to SF Pro
