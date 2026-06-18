/**
 * Summary overlay — a tab on the composer opens a slide-up panel
 * that covers the model grid without changing its layout. User picks a model,
 * taps Generate / Regenerate, and sees a streaming structured comparison.
 */
import { ModelList } from '@/components/ModelList'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getModelDef } from '@shared/models'
import { AnimatedMarkdown } from 'flowtoken'
import 'flowtoken/dist/styles.css'
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Sparkles,
  Square,
  X
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** OpenRouter model ids from the user's saved library. */
  models: string[]
  /** Visible panes whose latest replies will be compared. */
  comparedPanes: Array<{ modelId: string; label: string }>
  disabled?: boolean
  selectedModelId: string | null
  onSelectModel: (modelId: string) => void
  content: string
  streaming: boolean
  onGenerate: () => void
  onAbort: () => void
}

const markdownStyles = {
  p({ children }: React.ComponentProps<'p'>) {
    return <p className="mb-2 last:mb-0 text-sm leading-relaxed">{children}</p>
  },
  h2({ children }: React.ComponentProps<'h2'>) {
    return <h2 className="text-sm font-semibold mt-4 mb-1.5 first:mt-0 text-foreground">{children}</h2>
  },
  ul({ children }: React.ComponentProps<'ul'>) {
    return <ul className="list-disc pl-4 mb-2 space-y-1 text-sm">{children}</ul>
  },
  li({ children }: React.ComponentProps<'li'>) {
    return <li className="leading-relaxed">{children}</li>
  },
  strong({ children }: React.ComponentProps<'strong'>) {
    return <strong className="font-semibold text-foreground">{children}</strong>
  },
}

/** Slide animation duration — keep MainApp unmount delay in sync. */
export const SUMMARY_OVERLAY_ANIM_MS = 300

/** Tab handle anchored to the top edge of the composer section. */
export function SummaryTab({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={open ? 'Close summary' : 'Summarize the latest responses'}
      className={cn(
        'absolute left-1/2 -translate-x-1/2 -top-3 z-20',
        'flex items-center gap-1.5 px-4 py-1 rounded-t-lg',
        'border border-b-0 border-border shadow-sm text-sm font-medium',
        'transition-colors',
        open ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-muted/80'
      )}
    >
      <Sparkles className={cn('h-3.5 w-3.5', !open && 'text-amber-500')} />
      Summarize
      {open ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronUp className="h-3.5 w-3.5" />
      )}
    </button>
  )
}

export function SummaryOverlay({
  open,
  onOpenChange,
  models,
  comparedPanes,
  disabled,
  selectedModelId,
  onSelectModel,
  content,
  streaming,
  onGenerate,
  onAbort
}: Props) {
  const [modelPickerOpen, setModelPickerOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  const modelIds = models
  const current = selectedModelId ? getModelDef(selectedModelId) : null
  const hasSummary = content.length > 0

  useEffect(() => {
    if (!open) setModelPickerOpen(false)
  }, [open])

  useEffect(() => {
    if (!modelPickerOpen) return
    const onDown = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setModelPickerOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModelPickerOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [modelPickerOpen])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !streaming) onOpenChange(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, streaming, onOpenChange])

  const copySummary = async () => {
    if (!content) return
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard unavailable */
    }
  }

  const chooseModel = (modelId: string) => {
    onSelectModel(modelId)
    setModelPickerOpen(false)
  }

  return (
    <div
      aria-hidden={!open}
      className={cn(
        'absolute inset-0 z-10 flex flex-col border-t border-border/50 shadow-2xl',
        'bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/70',
        'transition-transform duration-300 ease-out will-change-transform',
        open ? 'translate-y-0' : 'translate-y-full',
        !open && 'pointer-events-none'
      )}
    >
      {/* Toolbar — title, source panes, and actions in one block */}
      <div className="shrink-0 border-b border-border/50 bg-background/40 px-4 py-3">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold leading-tight">Summarize latest responses</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Latest question and reply from each visible pane
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {hasSummary && !streaming && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={copySummary}
                    title={copied ? 'Copied' : 'Copy summary'}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => onOpenChange(false)}
                  disabled={streaming}
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {comparedPanes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] text-muted-foreground shrink-0">Comparing</span>
                {comparedPanes.map((pane, i) => {
                  const def = getModelDef(pane.modelId)
                  return (
                    <span
                      key={`${pane.modelId}-${i}`}
                      className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground/90"
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', def.color)} />
                      {pane.label}
                    </span>
                  )
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <div ref={pickerRef} className="relative min-w-[180px] flex-1 max-w-xs">
                <button
                  type="button"
                  onClick={() => setModelPickerOpen((o) => !o)}
                  disabled={disabled || models.length === 0}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md border border-border px-3 py-1.5',
                    'hover:bg-muted/50 transition-colors text-left',
                    (disabled || models.length === 0) && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <span
                    className={cn('w-2 h-2 rounded-full shrink-0', current?.color ?? 'bg-muted-foreground/40')}
                  />
                  <span className="text-sm truncate flex-1">
                    {current?.label ?? 'Pick a model to summarize with'}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                </button>

                {modelPickerOpen && models.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
                    <div className="max-h-48 overflow-y-auto py-1">
                      <ModelList
                        models={modelIds}
                        heading="Your models"
                        activeModelId={selectedModelId}
                        onSelect={chooseModel}
                      />
                    </div>
                  </div>
                )}
              </div>

              {streaming ? (
                <>
                  <Button variant="destructive" size="sm" className="gap-1.5 h-8" onClick={onAbort}>
                    <Square className="h-3.5 w-3.5" fill="currentColor" />
                    Stop
                  </Button>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    via {current?.label ?? 'model'}…
                  </span>
                </>
              ) : (
                <Button
                  size="sm"
                  className="gap-1.5 h-8"
                  disabled={!selectedModelId || disabled}
                  onClick={onGenerate}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  {hasSummary ? 'Regenerate' : 'Generate'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
        {!selectedModelId && !content && !streaming && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2 py-12">
            <Sparkles className="h-8 w-8 text-amber-500/60" />
            <p className="text-sm font-medium text-foreground">Select a model and generate</p>
            <p className="text-xs max-w-sm">
              Your summary will compare the latest replies shown above. Close anytime via ✕ or the
              Summarize tab below.
            </p>
          </div>
        )}

        {selectedModelId && !content && !streaming && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2 py-12">
            <p className="text-sm font-medium text-foreground">Ready when you are</p>
            <p className="text-xs max-w-sm">Click Generate to build a structured comparison.</p>
          </div>
        )}

        {(content || streaming) && selectedModelId && (
          <div className="max-w-3xl mx-auto">
            {content ? (
              <AnimatedMarkdown
                content={content}
                sep="word"
                animation={streaming ? 'fadeIn' : null}
                animationDuration="0.25s"
                animationTimingFunction="ease-out"
                customComponents={markdownStyles}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce" />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
