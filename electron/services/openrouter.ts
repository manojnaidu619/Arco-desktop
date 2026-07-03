/**
 * OpenRouter API client.
 *
 * This runs in the MAIN process only — it's the single place that ever sees
 * the user's API key or talks to the network. The renderer never holds the
 * key; it just asks the main process to do the work.
 *
 * Two responsibilities:
 *   1. `validateKey` — check a key works and fetch its credit balance.
 *   2. `streamChat`  — stream a chat completion token-by-token.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import type { BalanceInfo } from '@shared/api-contract'
import {
  OPENROUTER_APP_CATEGORIES,
  OPENROUTER_APP_REFERER,
  OPENROUTER_APP_TITLE
} from '@shared/config'
import type { Message, UrlCitation } from '@shared/types'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

/** OpenRouter app attribution headers — https://openrouter.ai/docs/app-attribution */
function openRouterHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': OPENROUTER_APP_REFERER,
    'X-OpenRouter-Title': OPENROUTER_APP_TITLE,
    'X-OpenRouter-Categories': OPENROUTER_APP_CATEGORIES
  }
}

/**
 * Validate an API key and return its credit balance.
 *
 * Throws an Error with a friendly message if the key is invalid or the
 * network is unreachable — the caller turns that into a UI error.
 */
export async function validateKey(apiKey: string): Promise<BalanceInfo> {
  const trimmed = apiKey.trim()
  if (!trimmed) throw new Error('Please enter an API key.')

  // `/key` is the canonical "is this key valid?" endpoint. A 200 means valid.
  const keyRes = await fetch(`${OPENROUTER_BASE}/key`, { headers: openRouterHeaders(trimmed) }).catch(() => {
    throw new Error('Could not reach OpenRouter. Check your internet connection.')
  })

  if (keyRes.status === 401) throw new Error('That key was rejected by OpenRouter. Double-check it and try again.')
  if (!keyRes.ok) throw new Error(`OpenRouter returned an error (${keyRes.status}). Try again in a moment.`)

  const keyJson = (await keyRes.json().catch(() => ({}))) as {
    data?: { label?: string; is_free_tier?: boolean; usage?: number; limit?: number | null }
  }

  // `/credits` gives a clearer "total vs used" balance for display.
  let totalCredits: number | null = keyJson.data?.limit ?? null
  let totalUsage = keyJson.data?.usage ?? 0
  try {
    const creditsRes = await fetch(`${OPENROUTER_BASE}/credits`, { headers: openRouterHeaders(trimmed) })
    if (creditsRes.ok) {
      const creditsJson = (await creditsRes.json()) as {
        data?: { total_credits?: number; total_usage?: number }
      }
      if (typeof creditsJson.data?.total_credits === 'number') totalCredits = creditsJson.data.total_credits
      if (typeof creditsJson.data?.total_usage === 'number') totalUsage = creditsJson.data.total_usage
    }
  } catch {
    // Balance is a nice-to-have; a key that passed `/key` is still valid.
  }

  const remaining = totalCredits === null ? null : Math.max(0, totalCredits - totalUsage)

  return {
    totalCredits,
    totalUsage,
    remaining,
    label: keyJson.data?.label,
    isFreeTier: keyJson.data?.is_free_tier
  }
}

/** Result of a streamed chat completion. */
export interface StreamChatResult {
  content: string
  annotations: UrlCitation[]
}

/** OpenRouter assistant message annotation types — https://openrouter.ai/docs/guides/features/server-tools/web-search */
const OpenRouterAnnotationType = {
  UrlCitation: 'url_citation',
  File: 'file'
} as const

type OpenRouterAnnotationType =
  (typeof OpenRouterAnnotationType)[keyof typeof OpenRouterAnnotationType]

type OpenRouterAnnotation = {
  type?: OpenRouterAnnotationType
  url_citation?: {
    url?: string
    title?: string
    content?: string
    start_index?: number
    end_index?: number
  }
}

/** Normalize OpenRouter annotation objects into UrlCitation entries. */
function parseUrlCitations(raw: unknown): UrlCitation[] {
  if (!Array.isArray(raw)) return []

  const citations: UrlCitation[] = []
  for (const item of raw as OpenRouterAnnotation[]) {
    if (item?.type !== OpenRouterAnnotationType.UrlCitation || !item.url_citation?.url) continue
    citations.push({
      url: item.url_citation.url,
      title: item.url_citation.title ?? item.url_citation.url,
      content: item.url_citation.content,
      start_index: item.url_citation.start_index,
      end_index: item.url_citation.end_index
    })
  }
  return citations
}

/** Merge citations by URL, keeping the first occurrence of each. */
function mergeCitations(existing: UrlCitation[], incoming: UrlCitation[]): UrlCitation[] {
  const seen = new Set(existing.map((c) => c.url))
  const merged = [...existing]
  for (const citation of incoming) {
    if (seen.has(citation.url)) continue
    seen.add(citation.url)
    merged.push(citation)
  }
  return merged
}

/** Server tools included on every chat completion request. */
function chatServerTools(webSearch: boolean) {
  return [
    // { type: 'openrouter:datetime' }, // Enabling makes responses slower, maybe inject this detail in the prompt instead
    ...(webSearch ? [{ type: 'openrouter:web_search' }] : [])
  ]
}

/**
 * Stream a chat completion from OpenRouter.
 *
 * Calls `onDelta` for each chunk of text as it arrives, and resolves with the
 * full assembled content when the stream ends. Pass an AbortSignal to cancel.
 *
 * @param apiKey   The user's OpenRouter key (already decrypted).
 * @param openRouterModelId OpenRouter model ID, e.g. "openai/gpt-4o".
 * @param messages Conversation so far.
 * @param onDelta  Called with each new piece of text.
 * @param signal   AbortSignal to cancel the request mid-stream.
 * @param webSearch When true, also enable OpenRouter's openrouter:web_search server tool.
 * @returns        The complete response text and any web search citations.
 */
export async function streamChat(
  apiKey: string,
  openRouterModelId: string,
  messages: Message[],
  onDelta: (delta: string) => void,
  signal: AbortSignal,
  webSearch = false
): Promise<StreamChatResult> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: openRouterHeaders(apiKey),
    body: JSON.stringify({
      model: openRouterModelId,
      messages,
      stream: true,
      tools: chatServerTools(webSearch)
    }),
    signal
  })

  if (!res.ok || !res.body) {
    // Surface OpenRouter's own error message when it provides one.
    const errText = await res.text().catch(() => '')
    let message = `OpenRouter error (${res.status})`
    try {
      const parsed = JSON.parse(errText)
      message = parsed?.error?.message ?? message
    } catch {
      /* keep default message */
    }
    throw new Error(message)
  }

  // OpenRouter streams Server-Sent Events: lines of `data: {json}` plus a
  // final `data: [DONE]`. We accumulate bytes, split on newlines, and parse
  // each complete line — the exact same protocol the web prototype handled.
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  let annotations: UrlCitation[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? '' // keep the last partial line for the next chunk

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        const delta = parsed.choices?.[0]?.delta?.content
        if (typeof delta === 'string' && delta.length > 0) {
          fullContent += delta
          onDelta(delta)
        }

        const deltaAnnotations = parseUrlCitations(parsed.choices?.[0]?.delta?.annotations)
        const messageAnnotations = parseUrlCitations(parsed.choices?.[0]?.message?.annotations)
        if (deltaAnnotations.length > 0) {
          annotations = mergeCitations(annotations, deltaAnnotations)
        }
        if (messageAnnotations.length > 0) {
          annotations = mergeCitations(annotations, messageAnnotations)
        }
      } catch {
        // Ignore malformed/keep-alive lines.
      }
    }
  }

  return { content: fullContent, annotations }
}

/** Result of checking whether an OpenRouter model id exists in the catalog. */
export interface ModelValidationResult {
  ok: boolean
  /** Human-readable error when `ok` is false. */
  error?: string
  /** Display name from OpenRouter when `ok` is true. */
  modelName?: string
}

/**
 * Verify that a model id exists on OpenRouter before saving it to the user's library.
 *
 * Uses OpenRouter's single-model lookup endpoint (`GET /model/{author}/{slug}`).
 *
 * @param apiKey  The user's stored OpenRouter key.
 * @param openRouterModelId OpenRouter model ID, e.g. "openai/gpt-4o".
 */
export async function validateModel(apiKey: string, openRouterModelId: string): Promise<ModelValidationResult> {
  const trimmed = openRouterModelId.trim()
  if (!trimmed) return { ok: false, error: 'Please enter a model id.' }

  const slash = trimmed.indexOf('/')
  if (slash === -1) {
    return { ok: false, error: 'Model id should look like "provider/model-name".' }
  }

  const author = trimmed.slice(0, slash)
  const slug = trimmed.slice(slash + 1)
  const url = `${OPENROUTER_BASE}/model/${author}/${slug}`

  const res = await fetch(url, { headers: openRouterHeaders(apiKey) }).catch(() => null)
  if (!res) {
    return { ok: false, error: 'Could not reach OpenRouter. Check your internet connection.' }
  }

  if (res.status === 404) {
    return { ok: false, error: 'That model was not found on OpenRouter. Check the id and try again.' }
  }

  if (!res.ok) {
    return { ok: false, error: `OpenRouter returned an error (${res.status}). Try again in a moment.` }
  }

  try {
    const json = (await res.json()) as { data?: { name?: string }; name?: string }
    const modelName = json.data?.name ?? json.name
    return { ok: true, modelName }
  } catch {
    return { ok: true }
  }
}
