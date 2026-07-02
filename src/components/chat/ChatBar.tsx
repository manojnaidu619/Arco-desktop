/**
 * The shared composer at the bottom of the main area. Sits to the right of the
 * layout selector, stretches to fill the remaining width, and broadcasts each
 * send to every visible pane. Enter sends; Shift+Enter inserts a newline.
 *
 * While any pane is streaming, the send button becomes a STOP button. Stopping
 * keeps the user message and any partial assistant reply in the thread.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { ArrowUp, Globe, Square } from 'lucide-react'

interface Props {
  value: string
  onValueChange: (value: string) => void
  /** How many visible panes will receive a broadcast (models still in library). */
  activeCount: number
  /** Visible panes with a model removed from the library (excluded from broadcast). */
  skippedCount?: number
  /** True while any pane is streaming — shows the stop button. */
  streaming?: boolean
  /** When true, the composer is read-only (e.g. summary overlay is open). */
  locked?: boolean
  /** Whether web search is enabled for the next broadcast send. */
  webSearchEnabled?: boolean
  onToggleWebSearch?: () => void
  onSend: (content: string) => void
  onAbort: () => void
}

export function ChatBar({
  value,
  onValueChange,
  activeCount,
  skippedCount = 0,
  streaming,
  locked,
  webSearchEnabled = false,
  onToggleWebSearch,
  onSend,
  onAbort
}: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const send = () => {
    const text = value.trim()
    if (!text || streaming || locked || activeCount === 0) return
    onSend(text)
    textareaRef.current?.focus()
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          onKeyDown={handleKey}
          placeholder={
            locked
              ? 'Close summary to send a message…'
              : streaming
                ? 'Generating… press ■ to stop'
                : activeCount === 0
                  ? 'Pick a model in a pane to begin…'
                  : activeCount === 1
                    ? 'Ask a question…'
                    : `Ask all ${activeCount} models at once…`
          }
          disabled={activeCount === 0 || locked}
          rows={2}
          className="resize-none border-0 shadow-none focus-visible:ring-0 text-sm leading-relaxed min-h-[56px] max-h-[200px] overflow-y-auto rounded-none"
        />
        <div className="flex items-center justify-between gap-2 px-2 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={onToggleWebSearch}
              disabled={locked || !onToggleWebSearch}
              title={
                webSearchEnabled
                  ? 'Web search on — model may search the web when needed (extra cost)'
                  : 'Web search off — enable to let the model search the web when needed'
              }
              aria-pressed={webSearchEnabled}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors shrink-0',
                webSearchEnabled
                  ? 'bg-primary/10 text-primary hover:bg-primary/15'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                (locked || !onToggleWebSearch) && 'opacity-50 pointer-events-none'
              )}
            >
              <Globe className="h-3.5 w-3.5" />
              Web search
            </button>
          </div>
          {streaming ? (
            <Button
              size="icon"
              variant="destructive"
              className="h-9 w-9 shrink-0 rounded-full"
              onClick={onAbort}
              title="Stop generating"
            >
              <Square className="h-4 w-4" fill="currentColor" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full"
              onClick={send}
              disabled={!value.trim() || activeCount === 0 || locked}
              title="Send message"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {activeCount > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          {locked
            ? 'Composer paused while summary is open · close summary to continue chatting'
            : streaming
              ? 'Generating across panes · click stop to end generation'
              : activeCount === 1
                ? skippedCount > 0
                  ? `${skippedCount} pane${skippedCount > 1 ? 's' : ''} skipped (removed from library) · Enter to send · Shift+Enter for newline`
                  : 'Enter to send · Shift+Enter for newline'
                : skippedCount > 0
                  ? `Sending to ${activeCount} models · ${skippedCount} pane${skippedCount > 1 ? 's' : ''} skipped (removed from library) · Enter to send · Shift+Enter for newline`
                  : `Sending to ${activeCount} models simultaneously · Enter to send · Shift+Enter for newline`}
        </p>
      )}
    </div>
  )
}
