/**
 * One grid pane. Header carries the per-pane model dropdown plus controls
 * (follow-up toggle, maximize); the body shows the conversation; the footer is
 * a follow-up input that's hidden until toggled on.
 *
 * Switching the model clears the pane — if it already has messages, we confirm
 * first.
 */
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Pane } from '@/hooks/useChat'
import { useSavedModels } from '@/hooks/useSavedModels'
import { cn } from '@/lib/utils'
import { getModelDef, isModelInLibrary } from '@shared/models'
import { AlertCircle, ArrowUp, Loader2, Maximize2, MessageSquare, Minimize2, Square } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MessageBubble } from './MessageBubble'
import { ModelDropdown } from './ModelDropdown'

interface Props {
  pane: Pane
  isExpanded?: boolean
  onToggleExpand?: () => void
  onSelectModel: (slot: number, modelId: string) => void
  onAskOne: (slot: number, content: string) => void
  /** Stop this pane's stream. */
  onAbortPane: (slot: number) => void
}

export function ModelPane({ pane, isExpanded = false, onToggleExpand, onSelectModel, onAskOne, onAbortPane }: Props) {
  const { savedModels } = useSavedModels()
  const [input, setInput] = useState('')
  const [showInput, setShowInput] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isRemoved = Boolean(pane.modelId && !isModelInLibrary(pane.modelId, savedModels))

  // Hide the follow-up input when the model is removed from the library.
  useEffect(() => {
    if (isRemoved) setShowInput(false)
  }, [isRemoved])

  // Keep each pane pinned to the bottom (newest message). We jump instantly
  // (behavior 'auto') inside a layout effect so it lands at the bottom BEFORE
  // paint — opening a session, switching layouts, or streaming never shows a
  // visible scroll-through. The pane is simply always at the bottom.
  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto' })
  }, [pane.messages])

  const send = () => {
    const text = input.trim()
    if (!text || pane.status === 'streaming' || !pane.modelId || isRemoved) return
    setInput('')
    onAskOne(pane.slot, text)
  }

  const handleAbort = () => {
    onAbortPane(pane.slot)
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
    <div className="flex flex-col overflow-hidden bg-background h-full min-h-0 min-w-0">
      {/* Header */}
      <div className="flex items-center gap-1 px-2 py-2 bg-muted/30 shrink-0">
        <div className="flex-1 min-w-0">
          <ModelDropdown value={pane.modelId} onSelect={handleSelectModel} />
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {pane.status === 'streaming' && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {pane.status === 'error' && <AlertCircle className="h-3.5 w-3.5 text-destructive" />}
          {isRemoved && <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
          <Button
            size="icon"
            variant="ghost"
            className={cn('h-6 w-6 shrink-0 text-muted-foreground', showInput && 'bg-muted text-foreground')}
            onClick={() => setShowInput((s) => !s)}
            disabled={isRemoved}
            title={
              isRemoved
                ? 'Follow-up unavailable — model removed from library'
                : showInput
                  ? 'Hide follow-up input'
                  : 'Show follow-up input'
            }
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

      {isRemoved && (
        <div className="flex items-start gap-2 text-amber-700 dark:text-amber-400 bg-amber-500/10 px-3 py-2 text-xs shrink-0">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            This model was removed from your library. Re-add it in the settings to continue
            the conversation.
          </span>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3 scrollbar-thin">
        {!pane.modelId ? (
          <p className="text-xs text-muted-foreground text-center mt-8">Pick a model to start.</p>
        ) : (
          <>
            {pane.messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center mt-8">Waiting for your question…</p>
            )}
            <div className="space-y-3 max-w-3xl mx-auto w-full min-w-0">
              {pane.messages.map((msg, i) => (
                <MessageBubble
                  key={i}
                  message={msg}
                  isStreaming={
                    pane.status === 'streaming' && msg.role === 'assistant' && i === pane.messages.length - 1
                  }
                />
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
      {showInput && pane.modelId && !isRemoved && (
        <div className="flex gap-2 px-3 py-2.5 shrink-0">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder={`Follow up with ${pane.label}…`}
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
            <Button size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={send} disabled={!input.trim()}>
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
