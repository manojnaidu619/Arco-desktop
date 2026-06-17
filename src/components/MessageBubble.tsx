/**
 * Renders one chat message. User turns are simple bubbles; assistant turns
 * render Markdown (code blocks, lists, headings). Both expose a copy button
 * BELOW the bubble that reveals on hover (assistant left-aligned, user
 * right-aligned). The copy row reserves its height so content never shifts.
 */
import { useState } from 'react'
import type { Message } from '@shared/types'
import { cn } from '@/lib/utils'
import { Check, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

interface Props {
  message: Message
  /** True while this assistant turn's stream is still in flight. */
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming = false }: Props) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'

  const copyResponse = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  // Small copy button that fades in on hover of the message group. The row that
  // holds it always reserves height, so revealing it never nudges content.
  const copyButton = (
    <button
      type="button"
      onClick={copyResponse}
      title={copied ? 'Copied' : 'Copy message'}
      aria-label={copied ? 'Copied' : 'Copy message'}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  )

  if (isUser) {
    return (
      <div className="group flex flex-col items-end">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3.5 py-2 max-w-[85%] text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
        <div className="h-5 mt-1 flex items-center pr-0.5">{copyButton}</div>
      </div>
    )
  }

  // Stream just started — no text has arrived yet. Show a typing indicator
  // (three bouncing dots) instead of an empty bubble with a premature copy button.
  if (isStreaming && !message.content) {
    return (
      <div className="flex justify-start">
        <div className="rounded-2xl rounded-tl-sm px-3.5 py-2.5 bg-muted">
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex flex-col items-start">
      <div
        className={cn(
          // min-w-0 + max-w-[95%] keep the bubble within its pane; break-words
          // wraps long URLs/tokens so nothing overflows horizontally.
          'rounded-2xl rounded-tl-sm px-3.5 py-2 max-w-[95%] min-w-0 text-sm break-words',
          'bg-muted text-foreground',
          'prose prose-sm dark:prose-invert',
          '[&_.prose]:m-0'
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            // Inline code = a pill. Block code is detected by the language class
            // or a newline, and is styled by the `pre` renderer below (so we
            // don't nest a styled <pre> inside react-markdown's default <pre>).
            code({ className, children, ...props }) {
              const isInline = !className?.includes('language-') && !String(children).includes('\n')
              return isInline ? (
                <code className="bg-zinc-200 dark:bg-zinc-700 rounded px-1 py-0.5 text-xs break-words" {...props}>
                  {children}
                </code>
              ) : (
                <code className={cn('text-xs text-zinc-100', className)} {...props}>
                  {children}
                </code>
              )
            },
            pre({ children }) {
              return (
                <pre className="bg-zinc-900 dark:bg-zinc-800 rounded-lg p-3 overflow-x-auto my-2 max-w-full">
                  {children}
                </pre>
              )
            },
            p({ children }) {
              return <p className="mb-2 last:mb-0">{children}</p>
            },
            ul({ children }) {
              return <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
            },
            ol({ children }) {
              return <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
            },
            h1({ children }) {
              return <h1 className="text-base font-bold mb-1">{children}</h1>
            },
            h2({ children }) {
              return <h2 className="text-sm font-bold mb-1">{children}</h2>
            },
            h3({ children }) {
              return <h3 className="text-sm font-semibold mb-1">{children}</h3>
            },
            // Tables can be wide — wrap in a horizontal scroller so they never
            // stretch the pane.
            table({ children }) {
              return (
                <div className="overflow-x-auto my-2 max-w-full">
                  <table className="w-full text-xs border-collapse">{children}</table>
                </div>
              )
            },
            th({ children }) {
              return <th className="border border-border px-2 py-1 text-left font-semibold">{children}</th>
            },
            td({ children }) {
              return <td className="border border-border px-2 py-1 align-top">{children}</td>
            },
            blockquote({ children }) {
              return (
                <blockquote className="border-l-2 border-border pl-3 italic text-muted-foreground my-2">
                  {children}
                </blockquote>
              )
            },
            a({ href, children }) {
              return (
                <a href={href} target="_blank" rel="noreferrer" className="text-primary underline break-words">
                  {children}
                </a>
              )
            },
            hr() {
              return <hr className="my-3 border-border" />
            }
          }}
        >
          {message.content}
        </ReactMarkdown>
      </div>
      {/* Copy sits below the bubble; reserved height (h-5) avoids any shift.
          Offered only once the stream has ended (completed or aborted). */}
      <div className="h-5 mt-1 flex items-center pl-0.5">{!isStreaming && copyButton}</div>
    </div>
  )
}
