/**
 * Renders one chat message. User turns are simple right-aligned bubbles;
 * assistant turns render Markdown (code blocks, lists, headings) and offer a
 * copy button.
 */
import { useState } from 'react'
import type { Message } from '@shared/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
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

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-3.5 py-2 max-w-[85%] text-sm whitespace-pre-wrap break-words">
          {message.content}
        </div>
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
    <div className="flex justify-start">
      <div
        className={cn(
          'rounded-2xl rounded-tl-sm px-3.5 py-2 max-w-[95%] text-sm',
          'bg-muted text-foreground',
          'prose prose-sm dark:prose-invert max-w-none',
          '[&_.prose]:m-0'
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkBreaks]}
          components={{
            code({ className, children, ...props }) {
              const isBlock = className?.includes('language-')
              return isBlock ? (
                <pre className="bg-zinc-900 dark:bg-zinc-800 rounded-lg p-3 overflow-x-auto my-2">
                  <code className={cn('text-xs text-zinc-100', className)} {...props}>
                    {children}
                  </code>
                </pre>
              ) : (
                <code className="bg-zinc-200 dark:bg-zinc-700 rounded px-1 py-0.5 text-xs" {...props}>
                  {children}
                </code>
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
            }
          }}
        >
          {message.content}
        </ReactMarkdown>
        {/* Copy is offered only once the stream has ended (completed or aborted). */}
        {!isStreaming && (
          <div className="flex justify-start pt-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={copyResponse}
              title={copied ? 'Copied' : 'Copy response'}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
