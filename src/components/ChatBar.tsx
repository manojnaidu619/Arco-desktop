/**
 * The shared "ask all panes" composer at the bottom of the main area. Sits to
 * the right of the layout selector and stretches to fill the remaining width.
 * Enter sends; Shift+Enter inserts a newline.
 *
 * While any pane is streaming, the send button becomes a STOP button. Stopping
 * keeps the user message and any partial assistant reply in the thread.
 */
import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ArrowUp, BrainCircuit, Square } from 'lucide-react'

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
      <div className="flex items-end gap-2">
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
                  : `Ask all ${activeCount} model${activeCount > 1 ? 's' : ''} at once…`
          }
          disabled={activeCount === 0 || locked}
          rows={2}
          className="resize-none text-sm leading-relaxed flex-1 min-h-[56px] max-h-[200px] overflow-y-auto"
        />
        {streaming ? (
          <Button
            size="icon"
            variant="destructive"
            className="h-[56px] w-[56px] shrink-0"
            onClick={onAbort}
            title="Stop generating"
          >
            <Square className="h-4 w-4" fill="currentColor" />
          </Button>
        ) : (
          <Button
            size="icon"
            className="h-[56px] w-[56px] shrink-0 rounded-full"
            onClick={send}
            disabled={!value.trim() || activeCount === 0 || locked}
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        )}
      </div>
      {activeCount > 0 && (
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <BrainCircuit className="h-3.5 w-3.5" />
          {locked
            ? 'Composer paused while summary is open · close summary to continue chatting'
            : streaming
              ? 'Generating across panes · click stop to end generation'
              : skippedCount > 0
                ? `Sending to ${activeCount} model${activeCount > 1 ? 's' : ''} · ${skippedCount} pane${skippedCount > 1 ? 's' : ''} skipped (removed from library) · Enter to send · Shift+Enter for newline`
                : `Sending to ${activeCount} model${activeCount > 1 ? 's' : ''} simultaneously · Enter to send · Shift+Enter for newline`}
        </p>
      )}
    </div>
  )
}
