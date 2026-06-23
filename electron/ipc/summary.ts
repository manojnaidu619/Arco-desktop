/**
 * IPC handler for multi-model response summarization.
 *
 * Constructs a structured prompt from the user's question and model responses,
 * then streams a comparison via OpenRouter. Reuses streamChat for streaming.
 *
 * Streaming flow (same pattern as chat.ts):
 *   1. UI calls summary:start with requestId, model, userMessage, and responses
 *   2. Backend streams deltas via summary:delta events
 *   3. On completion: summary:done with full content
 *   4. On error: summary:error with message
 *   5. UI can call summary:abort to cancel mid-stream
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { CHANNELS, type SummaryStartRequest } from '@shared/api-contract';
import { ipcMain } from 'electron';
import { streamChat } from '../services/openrouter';
import { getKey } from '../services/store/secure-store';

/**
 * Build the summarization prompt from collected responses.
 *
 * @param userMessage — the original question the user asked
 * @param responses — array of model responses to compare
 * @returns formatted prompt string for the summarization model
 */
function buildSummaryPrompt(
  userMessage: string,
  responses: Array<{ modelLabel: string; content: string }>
): string {
  const responseBlocks = responses
    .map((r) => `[Model: ${r.modelLabel}]\n${r.content}`)
    .join('\n\n')

  return `You are a synthesis analyst. Multiple AI models answered the same question. Produce one comprehensive summary so the user never needs to read each response individually.

Stay neutral — never pick a winner. Let the user decide.

**User's Question:** ${userMessage}

**Model Responses:** ${responseBlocks}

---

BEFORE WRITING, silently:
1. Classify the question (factual / advisory-decision / opinion / technical / creative / research) — this shapes your focus: accuracy for factual, trade-offs for decisions, correctness for technical, range of perspectives for opinion.
2. Gauge divergence to set length: high agreement → ~150–250 words, moderate → ~300-500, high divergence → ~500-800. Let content dictate length; never pad or over-trim.

WRITE using these sections. Skip any section with nothing meaningful to report.

## The Short Answer
2–4 sentence direct answer, synthesized from all models. No attribution — just the unified takeaway. For opinion/decision questions: frame what it depends on.

## Where Models Agree
Specific points of consensus. Be concrete — name exact claims, not vague summaries.

## Where Models Differ
Per disagreement: state the topic, what each model said (use **bold model names**), and why they may differ if apparent. Don't manufacture differences — different wording for the same point is agreement.

## Standout Insights
Genuinely valuable points only 1–2 models raised. Always attribute: "**[Model Name]** uniquely noted..."

## Caveats & Red Flags
Only if applicable: contradictory facts between models (flag clearly), uncertainty, warnings, dubious claims.

## Gaps
Only if an obvious important angle was missed by ALL models (1–2 sentences max).

## Per-Model Snapshot
1–2 sentences per model: what angle it focused on, its strength/limitation here, and what to read it for.
Format: **[Model Name]** — [characterization]. Read in full for [specific angle].

RULES:
- Use simple, plain language. Model responses can be technical and dense — translate ideas into clear everyday words without losing accuracy.
- Use exact model names from response blocks, bold when attributing.
- Be specific: "recommended PostgreSQL for ACID compliance" not "recommended a database."
- Paraphrase — don't copy large blocks from responses.
- Adjust language for model count (don't say "most models" for 2 models).
- Note off-topic or weak responses diplomatically in the snapshot.
- Add no outside knowledge except in Gaps.`
}

/** Active summary requests mapped by requestId for abort support. */
const activeRequests = new Map<string, AbortController>()

/**
 * Register IPC handlers for summary streaming.
 *
 * @used-by registerIpcHandlers in ipc/index.ts
 */
export function registerSummaryHandlers(): void {
  // ── Start a summary stream ────────────────────────────────────────────────
  ipcMain.on(CHANNELS.summary.start, async (event, req: SummaryStartRequest) => {
    const { requestId, openRouterModelId, userMessage, responses } = req
    const sender = event.sender

    // Retrieve API key from secure storage (Keychain on macOS)
    const apiKey = getKey()
    if (!apiKey) {
      // Guard: sender may have been destroyed if window closed during async work
      if (!sender.isDestroyed()) {
        sender.send(CHANNELS.summary.error, {
          requestId,
          message: 'No API key found. Add one in Settings.'
        })
      }
      return
    }

    // Track this request for potential abort
    const controller = new AbortController()
    activeRequests.set(requestId, controller)

    const messages = [{ role: 'user' as const, content: buildSummaryPrompt(userMessage, responses) }]

    try {
      const content = await streamChat(
        apiKey,
        openRouterModelId,
        messages,
        (delta) => {
          // Guard: window may close mid-stream
          if (!sender.isDestroyed()) {
            sender.send(CHANNELS.summary.delta, { requestId, delta })
          }
        },
        controller.signal
      )
      if (!sender.isDestroyed()) {
        sender.send(CHANNELS.summary.done, { requestId, content })
      }
    } catch (err) {
      // AbortError is expected when user cancels — don't treat as error
      if ((err as Error)?.name === 'AbortError') return
      if (!sender.isDestroyed()) {
        sender.send(CHANNELS.summary.error, {
          requestId,
          message: err instanceof Error ? err.message : 'Summary failed'
        })
      }
    } finally {
      activeRequests.delete(requestId)
    }
  })

  // ── Abort a summary stream ────────────────────────────────────────────────
  ipcMain.on(CHANNELS.summary.abort, (_event, requestId: string) => {
    activeRequests.get(requestId)?.abort()
    activeRequests.delete(requestId)
  })
}
