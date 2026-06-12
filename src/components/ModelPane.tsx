/**
 * One grid pane. Header carries the per-pane model dropdown plus controls
 * (follow-up toggle, maximize); the body shows the conversation; the footer is
 * a follow-up input that's hidden until toggled on.
 *
 * Switching the model clears the pane — if it already has messages, we confirm
 * first.
 */
import { useEffect, useRef, useState } from 'react'
import type { Pane } from '@/hooks/useChat'
import { getModelDef } from '@shared/models'
import { MessageBubble } from './MessageBubble'
import { ModelDropdown } from './ModelDropdown'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { AlertCircle, Loader2, Maximize2, MessageSquare, Minimize2, Send, Square } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  pane: Pane
  isExpanded?: boolean
  onToggleExpand?: () => void
  onSelectModel: (slot: number, modelId: string) => void
  onAskOne: (slot: number, content: string) => void
  /** Abort this pane's stream; returns the just-sent text to restore for editing. */
  onAbortPane: (slot: number) => string
}

export function ModelPane({ pane, isExpanded = false, onToggleExpand, onSelectModel, onAskOne, onAbortPane }: Props) {
  const [input, setInput] = useState('')
  const [showInput, setShowInput] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const didMountRef = useRef(false)

  // Auto-scroll to the newest content as the model streams — but NOT on the
  // first render. On initial load and on layout changes (which re-mount the
  // panes), we leave each pane scrolled where it is instead of yanking it to
  // the bottom. We only follow content that arrives afterwards (a new message
  // or streaming tokens).
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [pane.messages])

  const send = () => {
    const text = input.trim()
    if (!text || pane.status === 'streaming' || !pane.modelId) return
    setInput('')
    onAskOne(pane.slot, text)
  }

  // Stop this pane's stream and put the aborted question back in the input.
  const handleAbort = () => {
    setInput(onAbortPane(pane.slot) || '')
  }

  const handleSelectModel = (modelId: string) => {
    // Confirm before clearing an in-progress conversation.
    if (pane.modelId && modelId !== pane.modelId && pane.messages.length > 0) {
      const ok = window.confirm(
        `Switch this pane to "${getModelDef(modelId).label}"? Its current conversation will be cleared.`
      )
      if (!ok) return
    }
    onSelectModel(pane.slot, modelId)
  }

  return (
    <div className="flex flex-col border border-border rounded-xl overflow-hidden bg-background h-full min-h-0 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-2 border-b border-border bg-muted/50 shrink-0">
        <div className="flex-1 min-w-0">
          <ModelDropdown value={pane.modelId} onSelect={handleSelectModel} />
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {pane.status === 'streaming' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {pane.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
          <Button
            size="icon"
            variant="ghost"
            className={cn('h-6 w-6 shrink-0 text-muted-foreground', showInput && 'bg-muted text-foreground')}
            onClick={() => setShowInput((s) => !s)}
            title={showInput ? 'Hide follow-up input' : 'Show follow-up input'}
          >
            <MessageSquare className="h-3.5 w-3.5" />
          </Button>
          {onToggleExpand && (
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0 text-muted-foreground"
              onClick={onToggleExpand}
              title={isExpanded ? 'Collapse pane' : 'Expand pane'}
            >
              {isExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3">
        {!pane.modelId ? (
          <p className="text-xs text-muted-foreground text-center mt-8">Pick a model to start.</p>
        ) : (
          <>
            {pane.messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-8">Waiting for your question…</p>
            )}
            <div className="space-y-3 max-w-3xl mx-auto w-full min-w-0">
              {pane.messages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              {pane.status === 'error' && pane.error && (
                <div className="flex items-start gap-2 text-destructive bg-destructive/10 rounded-lg px-3 py-2 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{pane.error}</span>
                </div>
              )}
            </div>
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Per-pane follow-up input (hidden until toggled) */}
      {showInput && pane.modelId && (
        <div className="flex gap-2 px-3 py-2.5 border-t border-border shrink-0">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={`Follow up with ${pane.label}…`}
            disabled={pane.status === 'streaming'}
            className="text-sm h-8"
            autoFocus
          />
          {pane.status === 'streaming' ? (
            <Button
              size="icon"
              variant="destructive"
              className="h-8 w-8 shrink-0"
              onClick={handleAbort}
              title="Stop generating"
            >
              <Square className="h-3 w-3" fill="currentColor" />
            </Button>
          ) : (
            <Button size="icon" className="h-8 w-8 shrink-0" onClick={send} disabled={!input.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
