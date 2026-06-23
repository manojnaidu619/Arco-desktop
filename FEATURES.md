# Arco Feature Roadmap

## Guidelines
This document tracks upcoming features, improvements, and technical enhancements for the Arco desktop application.

### Status Legend
- 🔴 `[ ]` **Not Started** - Feature identified but not yet begun
- 🟡 `[~]` **In Progress** - Currently being developed  
- 🟢 `[x]` **Completed** - Feature implemented and merged

### How to Use
1. Add new feature requests to the appropriate category below
2. Update checkbox `[ ]` → `[~]` → `[x]` and emoji as work progresses
3. Keep descriptions concise and focused on user value
4. Add new features at the bottom of each section

### For AI Agents Adding Features
**Assume feature requests are well-thought-out.** Only ask minimal clarifying questions if genuinely needed:
- Ask only when the request is unclear or ambiguous
- Leverage your knowledge of the codebase to assess technical fit
- Confirm the feature entry with the user before adding
- Ask about priority only if it significantly impacts implementation order
- Avoid theoretical questions about problem-solving rationale

### Template for New Features
```markdown
### 🔴 [ ] Feature Name
**Priority:** High/Medium/Low  
**Description:** Brief description of what this feature does and why it's needed.
```

---

## Core Features

### 🔴 [ ] Session Pagination
**Priority:** High  
**Description:** Implement server-side pagination for session loading and search to improve performance with large conversation histories.

---

## UI/UX Improvements

*Add UI/UX enhancement requests here*

---

## Performance & Technical

### 🔴 [ ] Migrate Primary Model Identifier from OpenRouter ID to Database Model ID
**Priority:** High  
**Description:** Replace `openRouterModelId` (e.g. `openai/gpt-4o`) as the primary key for model-related business logic across the app with the database `models.id` row ID (`dbModelId`). Threads already store `model_id` in SQLite; panes, IPC payloads, hooks, and UI state should reference that ID and load the full model record (label, color, author/slug) from our `models` table instead of passing OpenRouter strings everywhere. OpenRouter model ID remains a derived property on the model row for API calls only. This refactor is needed now that we persist the user's model library locally—we no longer need OpenRouter's identifier as the central identifier outside of outbound chat requests.

### 🔴 [ ] License Key Server Validation
**Priority:** Medium  
**Description:** On app launch, re-validate the stored license with the Arco license server (send license key from `license.bin` and current `machineIdSync()` device ID). If validation fails, treat the user as Free tier and show a support modal — do not delete the local license file. Complements encrypted `license.bin` storage (which blocks casual file copy) by catching revoked keys and device mismatches when online. Activation via `/api/licenses/activate` remains unchanged.

---

## Developer Experience

*Add tooling and development workflow improvements here*

---

## Completed Features

### 🟢 [x] Multi-Model Response Summarization
**Priority:** High  
**Description:** Slide-up overlay that synthesizes the latest replies from all visible panes into a structured comparison (consensus, disagreements, standout insights). User picks a summarizer model from their library; summary streams via OpenRouter and is ephemeral (not persisted).

### 🟢 [x] Session Search Bar
**Priority:** Medium  
**Description:** Real-time search functionality in the sidebar to filter conversations by title.

### 🟢 [x] Sidebar Visual Improvements
**Priority:** Low  
**Description:** Enhanced sidebar styling with better selection highlighting and animated model badges.