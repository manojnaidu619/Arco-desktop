/**
 * Renders one chat message. User turns are simple bubbles; assistant turns
 * render Markdown via flowtoken's AnimatedMarkdown.
 *
 * Styling contract:
 *  - flowtoken → streaming text reveal only (fadeIn per word via animateText)
 *  - markdownStyleOverrides → all Tailwind classes and layout (our theme)
 *
 * The same renderer runs while streaming and after completion; animation is
 * toggled via the animation prop. Both expose a copy button BELOW the bubble
 * that reveals on hover (assistant left-aligned, user right-aligned). The copy
 * row reserves its height so content never shifts.
 */
import { useState, type ReactNode } from 'react'
import type { Message } from '@shared/types'
import { cn } from '@/lib/utils'
import { Check, Copy } from 'lucide-react'
import { AnimatedMarkdown } from 'flowtoken'
import 'flowtoken/dist/styles.css'

interface Props {
  message: Message
  /** True while this assistant turn's stream is still in flight. */
  isStreaming?: boolean
}

/** Per-word reveal callback that flowtoken injects into customComponents while streaming. */
type FlowtokenAnimateText = (text: ReactNode) => ReactNode

type MarkdownOverrideProps<T extends keyof React.JSX.IntrinsicElements> =
  React.ComponentProps<T> & { animateText?: FlowtokenAnimateText }

/**
 * Renders text children with flowtoken's streaming reveal when animateText is
 * present; otherwise returns children unchanged (stream finished or static).
 */
function renderTextWithStreamingAnimation(
  animateText: FlowtokenAnimateText | undefined,
  children: ReactNode,
) {
  return animateText ? animateText(children) : children
}

/** Bubble chrome for assistant markdown content. Element-level styles live below. */
const assistantMarkdownClass = cn(
  'rounded-2xl rounded-tl-sm px-3.5 py-2 max-w-[95%] min-w-0 text-sm break-words',
  'bg-muted text-foreground'
)

/**
 * Our markdown element styles — passed to AnimatedMarkdown customComponents to
 * override flowtoken defaults. All classNames live here; flowtoken only supplies
 * animateText for streaming reveal via renderTextWithStreamingAnimation.
 */
const markdownStyleOverrides = {
  code({
    animateText,
    className,
    children,
    ...props
  }: MarkdownOverrideProps<'code'>) {
    const isInline = !className?.includes('language-') && !String(children).includes('\n')
    return isInline ? (
      <code
        className="bg-zinc-200 dark:bg-zinc-700 rounded px-1 py-0.5 text-xs break-words"
        {...props}
      >
        {renderTextWithStreamingAnimation(animateText, children)}
      </code>
    ) : (
      <code className={cn('text-xs text-zinc-100', className)} {...props}>
        {renderTextWithStreamingAnimation(animateText, children)}
      </code>
    )
  },
  pre({ children }: React.ComponentProps<'pre'>) {
    return (
      <pre className="bg-zinc-900 dark:bg-zinc-800 rounded-lg p-3 overflow-x-auto my-2 max-w-full">
        {children}
      </pre>
    )
  },
  p({
    animateText,
    children,
    ...props
  }: MarkdownOverrideProps<'p'>) {
    return (
      <p className="mb-2 last:mb-0" {...props}>
        {renderTextWithStreamingAnimation(animateText, children)}
      </p>
    )
  },
  ul({ children }: React.ComponentProps<'ul'>) {
    return <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
  },
  ol({ children }: React.ComponentProps<'ol'>) {
    return <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
  },
  li({
    animateText,
    children,
    ...props
  }: MarkdownOverrideProps<'li'>) {
    return <li {...props}>{renderTextWithStreamingAnimation(animateText, children)}</li>
  },
  h1({
    animateText,
    children,
    ...props
  }: MarkdownOverrideProps<'h1'>) {
    return (
      <h1 className="text-lg font-bold mb-1 mt-2 first:mt-0" {...props}>
        {renderTextWithStreamingAnimation(animateText, children)}
      </h1>
    )
  },
  h2({
    animateText,
    children,
    ...props
  }: MarkdownOverrideProps<'h2'>) {
    return (
      <h2 className="text-base font-bold mb-1 mt-2 first:mt-0" {...props}>
        {renderTextWithStreamingAnimation(animateText, children)}
      </h2>
    )
  },
  h3({
    animateText,
    children,
    ...props
  }: MarkdownOverrideProps<'h3'>) {
    return (
      <h3 className="text-sm font-semibold mb-1 mt-1 first:mt-0" {...props}>
        {renderTextWithStreamingAnimation(animateText, children)}
      </h3>
    )
  },
  table({ children }: React.ComponentProps<'table'>) {
    return (
      <div className="overflow-x-auto my-2 max-w-full">
        <table className="w-full text-xs border-collapse">{children}</table>
      </div>
    )
  },
  th({
    animateText,
    children,
    ...props
  }: MarkdownOverrideProps<'th'>) {
    return (
      <th className="border border-border px-2 py-1 text-left font-semibold" {...props}>
        {renderTextWithStreamingAnimation(animateText, children)}
      </th>
    )
  },
  td({
    animateText,
    children,
    ...props
  }: MarkdownOverrideProps<'td'>) {
    return (
      <td className="border border-border px-2 py-1 align-top" {...props}>
        {renderTextWithStreamingAnimation(animateText, children)}
      </td>
    )
  },
  blockquote({
    animateText,
    children,
    ...props
  }: MarkdownOverrideProps<'blockquote'>) {
    return (
      <blockquote
        className="border-l-2 border-border pl-3 italic text-muted-foreground my-2"
        {...props}
      >
        {renderTextWithStreamingAnimation(animateText, children)}
      </blockquote>
    )
  },
  a({
    animateText,
    href,
    children,
    ...props
  }: MarkdownOverrideProps<'a'>) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="text-primary underline break-words"
        {...props}
      >
        {renderTextWithStreamingAnimation(animateText, children)}
      </a>
    )
  },
  hr() {
    return <hr className="my-3 border-border" />
  },
  strong({
    animateText,
    children,
    ...props
  }: MarkdownOverrideProps<'strong'>) {
    return <strong {...props}>{renderTextWithStreamingAnimation(animateText, children)}</strong>
  },
  em({
    animateText,
    children,
    ...props
  }: MarkdownOverrideProps<'em'>) {
    return <em {...props}>{renderTextWithStreamingAnimation(animateText, children)}</em>
  },
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
      <div className={assistantMarkdownClass}>
        <AnimatedMarkdown
          content={message.content}
          sep="word"
          animation={isStreaming ? 'fadeIn' : null}
          animationDuration="0.3s"
          animationTimingFunction="ease-out"
          customComponents={markdownStyleOverrides}
        />
      </div>
      <div className="h-5 mt-1 flex items-center gap-2 pl-0.5">
        {message.stopped && (
          <span className="text-xs text-muted-foreground">Generation stopped</span>
        )}
        {!isStreaming && copyButton}
      </div>
    </div>
  )
}
