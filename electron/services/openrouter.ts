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
 */
import type { BalanceInfo } from '@shared/api-contract'
import type { Message } from '@shared/types'

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'

/** Standard headers OpenRouter recommends for app identification. */
function headers(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://multi-mind.app',
    'X-Title': 'Multi-Mind'
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
  const keyRes = await fetch(`${OPENROUTER_BASE}/key`, { headers: headers(trimmed) }).catch(() => {
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
    const creditsRes = await fetch(`${OPENROUTER_BASE}/credits`, { headers: headers(trimmed) })
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

/**
 * Stream a chat completion from OpenRouter.
 *
 * Calls `onDelta` for each chunk of text as it arrives, and resolves with the
 * full assembled content when the stream ends. Pass an AbortSignal to cancel.
 *
 * @param apiKey   The user's OpenRouter key (already decrypted).
 * @param model    OpenRouter model id.
 * @param messages Conversation so far.
 * @param onDelta  Called with each new piece of text.
 * @param signal   AbortSignal to cancel the request mid-stream.
 * @returns        The complete response text.
 */
export async function streamChat(
  apiKey: string,
  model: string,
  messages: Message[],
  onDelta: (delta: string) => void,
  signal: AbortSignal
): Promise<string> {
  const res = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify({ model, messages, stream: true }),
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
      } catch {
        // Ignore malformed/keep-alive lines.
      }
    }
  }

  return fullContent
}
