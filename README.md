# Arco

**One question. Every model. All on your Mac.**

Arco lets you send a single prompt to multiple AI models at once and compare their answers side by side. No subscription. No data leaving your device. You connect your own OpenRouter API key and get access to every model OpenRouter supports.

---

## What makes Arco different

### You bring your own key

Most AI chat tools lock you into their subscription and their model selection. Arco connects directly through your OpenRouter API key — you pay OpenRouter's rates, choose any model they offer, and Arco takes nothing on top.

### Your data stays on your Mac

Every conversation is stored in a local database on your machine. Nothing is sent to our servers because we don't have any. Arco is a Mac app, not a cloud service.

### Any model, not just a whitelist

Because Arco routes through OpenRouter, you have access to thousands of models — open source, frontier, experimental — not just the ones a platform decided to support. Add any model by its OpenRouter ID.

### Compare, don't just chat

Send one message and see every model's answer at the same time, in a side-by-side grid. Useful for evaluating models, pressure-testing an idea, or just getting a second (and third) opinion.

---

## Brand usage

| Context                      | Use                  |
| ---------------------------- | -------------------- |
| Product / app name           | **Arco**             |
| Website                      | **arco.chat**        |
| Social handles               | **@arcochat**        |
| Email                        | **hello@arco.chat**  |
| In press or PR copy          | **Arco (arco.chat)** |
| App Store / dock / title bar | **Arco**             |

**Rules:**

- Always **Arco**, never "ArcoChat", "Arco Chat", or "ARCO"
- The `.chat` TLD does the descriptive work — don't append "Chat" to the product name
- Use **arco.chat** when pointing someone to download or learn more; use **Arco** when talking about the product in copy

---

## Core value props (for marketing copy)

- **BYOK** — Bring your own OpenRouter key. No platform fee, no markup.
- **Private by design** — Conversations live on your Mac, not our servers.
- **Model-agnostic** — Any model on OpenRouter, not a curated shortlist.
- **Side-by-side comparison** — One prompt, multiple answers, instant comparison.
- **Mac-native** — Built as a proper macOS desktop app, not a web wrapper.

---

## Tagline options

- _One question. Every model._
- _Your key. Your models. Your Mac._
- _Compare AI models side by side — privately._
- _All the models. None of the subscription._

---

## Logo & app icon

### Icon description

Deep midnight-blue squircle (macOS rounded-corner square) containing multiple concentric glowing arcs that fan outward from a lower-left origin point. The arcs graduate in color from electric cyan (innermost) through indigo to violet (outermost), with a soft ambient glow against the dark background. The mark reads at any size from 16 px to 1024 px without text.

### Icon files

All files live in `build/` at the project root (configured in `electron-builder.yml` as `buildResources: build`):

| File | Size | Purpose |
| ---- | ---- | ------- |
| `build/icon.icns` | Multi-resolution | macOS dock, Finder, title bar |
| `build/icon.ico` | Multi-resolution | Windows taskbar (future) |
| `build/icon.png` | 1024 × 1024 px | Fallback, DMG window, marketing |

The source PNG must be exactly **1024 × 1024 px**. To convert to `.icns`:

```bash
sips -z 1024 1024 icon.png --out icon-1024.png
# then use Image2icon or iconutil to produce the .icns bundle
```

### Icon usage rules

- Never place the icon on a light or white background — it requires a dark surface to read correctly
- Never crop, rotate, recolor, or add drop shadows to the icon itself
- Minimum display size: 16 × 16 px (macOS menu bar)
- For marketing, use the 1024 px PNG at 2× resolution for Retina

---

## Technical docs

For architecture, project structure, data flow, and how to extend the app — see the [`docs/`](./docs/README.md) folder.
