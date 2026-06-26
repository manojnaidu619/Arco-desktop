/**
 * The main application screen: the history sidebar, a grid of model panes, and
 * the bottom bar (layout selector + full-width "ask all" composer).
 *
 * Conversation state lives in `useChat`; this component owns layout/UI state
 * (sidebar open, which pane is expanded) and arranges the grid.
 *
 * @see STANDARDS.md for coding standards and conventions of this codebase
 */
import { ChatBar } from '@/components/chat/ChatBar'
import { GenerationInProgressDialog } from '@/components/GenerationInProgressDialog'
import { LayoutSelector } from '@/components/LayoutSelector'
import { ModelPane } from '@/components/model/ModelPane'
import { SessionLimitModal } from '@/components/SessionLimitModal'
import { Sidebar } from '@/components/Sidebar'
import { SUMMARY_OVERLAY_ANIM_MS, SummaryOverlay, SummaryTab } from '@/components/SummaryOverlay'
import { Button } from '@/components/ui/button'
import { useChat, type Pane } from '@/hooks/useChat'
import { useSavedModels } from '@/hooks/useSavedModels'
import { api } from '@/lib/api'
import { isModelInLibrary } from '@shared/models'
import { Loader2, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

/** How many grid columns each layout preset uses (rows then fill the height). */
const COLS: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 2, 6: 3 }

const STREAMING_NAV_DIALOG = {
  title: 'Generation in progress',
  message:
    'Stop generating before switching conversations or starting a new conversation. Use the ■ stop button in the composer or a pane.'
} as const

/** True when a pane has a completed latest turn (user asked + assistant replied). */
function paneHasLatestExchange(pane: Pane): boolean {
  const hasUser = pane.messages.some((m) => m.role === 'user')
  const last = pane.messages.at(-1)
  return (
    hasUser &&
    last?.role === 'assistant' &&
    last.content.length > 0 &&
    pane.status !== 'streaming'
  )
}

interface Props {
  onOpenSettings: () => void
  isLicenseActivated: boolean
  onOpenLicense: () => void
}

export function MainApp({ onOpenSettings, isLicenseActivated, onOpenLicense }: Props) {
  const {
    panes,
    layout,
    sessionId,
    sessions,
    loading,
    setLayout,
    applyVisibleSelection,
    setPaneModel,
    askAll,
    askOne,
    abort,
    abortPane,
    newSession,
    loadSession,
    renameSession,
    deleteSession
  } = useChat()

  const { savedModels } = useSavedModels()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null)
  const [composerValue, setComposerValue] = useState('')
  const [streamingNavBlocked, setStreamingNavBlocked] = useState(false)
  const [sessionLimitOpen, setSessionLimitOpen] = useState(false)

  // Summary overlay — streams a structured comparison via IPC
  const [summaryOverlayOpen, setSummaryOverlayOpen] = useState(false)
  const [summaryOverlayMounted, setSummaryOverlayMounted] = useState(false)
  const [summaryOpenRouterModelId, setSummaryOpenRouterModelId] = useState<string | null>(null)
  const [summaryContent, setSummaryContent] = useState('')
  const [summaryStreaming, setSummaryStreaming] = useState(false)
  const summaryRequestIdRef = useRef<string | null>(null)

  const visiblePanes = useMemo(() => panes.slice(0, layout), [panes, layout])
  const activeCount = useMemo(() => visiblePanes.filter((p) => p.openRouterModelId).length, [visiblePanes])
  const sendableCount = useMemo(
    () => visiblePanes.filter((p) => isModelInLibrary(p.openRouterModelId, savedModels)).length,
    [visiblePanes, savedModels]
  )
  const skippedCount = activeCount - sendableCount
  const populatedPanes = useMemo(
    () =>
      panes
        .filter((p) => p.openRouterModelId)
        .map((p) => ({ slot: p.slot, openRouterModelId: p.openRouterModelId!, label: p.label })),
    [panes]
  )
  const isAnyStreaming = panes.some((p) => p.status === 'streaming')

  const panesWithLatestExchange = useMemo(
    () => visiblePanes.filter(paneHasLatestExchange),
    [visiblePanes]
  )
  const comparedPanes = useMemo(
    () =>
      panesWithLatestExchange.map((p) => ({
        openRouterModelId: p.openRouterModelId!,
        label: p.label
      })),
    [panesWithLatestExchange]
  )
  // Summarize is a multi-pane feature — hide it while a single pane is expanded.
  // `expandedSlot === null` in showSummarizeTab also triggers the effect below that
  // closes the summary overlay when the user maximizes a pane.
  const showSummarizeTab =
    panesWithLatestExchange.length >= 2 && !isAnyStreaming && expandedSlot === null
  // Tab + extra composer padding stay visible while the overlay is animating closed,
  // but never while a pane is expanded (even mid-overlay teardown).
  const showSummarizeTabArea =
    expandedSlot === null && (showSummarizeTab || summaryOverlayMounted)

  const resetSummaryState = () => {
    setSummaryContent('')
    setSummaryStreaming(false)
    setSummaryOpenRouterModelId(null)
    summaryRequestIdRef.current = null
  }

  const abortSummary = () => {
    if (summaryRequestIdRef.current) {
      api.summary.abort(summaryRequestIdRef.current)
      summaryRequestIdRef.current = null
    }
    setSummaryContent('')
    setSummaryStreaming(false)
  }

  const generateSummary = () => {
    if (!summaryOpenRouterModelId) return

    const panesWithExchange = panesWithLatestExchange
    const userMessages = panesWithExchange[0]?.messages.filter((m) => m.role === 'user')
    const lastUserMessage = userMessages?.at(-1)?.content ?? ''

    const responses = panesWithExchange.map((p) => ({
      modelLabel: p.label,
      content: p.messages.at(-1)?.content ?? ''
    }))

    const requestId = crypto.randomUUID()
    summaryRequestIdRef.current = requestId
    setSummaryContent('')
    setSummaryStreaming(true)

    api.summary.start({
      requestId,
      openRouterModelId: summaryOpenRouterModelId,
      userMessage: lastUserMessage,
      responses
    })
  }

  const handleSelectSummaryModel = (openRouterModelId: string) => {
    setSummaryOpenRouterModelId(openRouterModelId)
    if (summaryContent) {
      setSummaryContent('')
      setSummaryStreaming(false)
      if (summaryRequestIdRef.current) {
        api.summary.abort(summaryRequestIdRef.current)
        summaryRequestIdRef.current = null
      }
    }
  }

  const openSummaryOverlay = () => {
    resetSummaryState()
    setSummaryOverlayMounted(true)
    // Double rAF so the closed transform paints before animating open.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setSummaryOverlayOpen(true))
    })
  }

  const closeSummaryOverlay = () => {
    if (summaryStreaming) abortSummary()
    setSummaryOverlayOpen(false)
  }

  const closeSummaryOverlayImmediate = () => {
    closeSummaryOverlay()
    setSummaryOverlayMounted(false)
    resetSummaryState()
  }

  const toggleSummaryOverlay = () => {
    if (summaryOverlayOpen) {
      closeSummaryOverlay()
    } else if (!summaryOverlayMounted) {
      openSummaryOverlay()
    }
  }

  useEffect(() => {
    const offDelta = api.summary.onDelta(({ requestId, delta }) => {
      if (requestId !== summaryRequestIdRef.current) return
      setSummaryContent((prev) => prev + delta)
    })

    const offDone = api.summary.onDone(({ requestId }) => {
      if (requestId !== summaryRequestIdRef.current) return
      setSummaryStreaming(false)
    })

    const offError = api.summary.onError(({ requestId, message }) => {
      if (requestId !== summaryRequestIdRef.current) return
      setSummaryStreaming(false)
      setSummaryContent('')
      console.error('Summary error:', message)
    })

    return () => {
      offDelta()
      offDone()
      offError()
    }
  }, [])

  // Unmount overlay after slide-down; purge summary state once fully collapsed.
  useEffect(() => {
    if (!summaryOverlayOpen && summaryOverlayMounted) {
      const t = window.setTimeout(() => {
        setSummaryOverlayMounted(false)
        resetSummaryState()
      }, SUMMARY_OVERLAY_ANIM_MS)
      return () => clearTimeout(t)
    }
  }, [summaryOverlayOpen, summaryOverlayMounted])

  // Always start collapsed when the active session changes (any navigation path).
  useEffect(() => {
    closeSummaryOverlayImmediate()
  }, [sessionId])

  // Close overlay when summarize is unavailable: streaming, <2 panes, or a pane expanded.
  useEffect(() => {
    if (!showSummarizeTab && summaryOverlayMounted) {
      closeSummaryOverlayImmediate()
    }
  }, [showSummarizeTab, summaryOverlayMounted])

  // Reset expansion when the layout shrinks or switches to single pane (no expand control).
  useEffect(() => {
    if (expandedSlot !== null && (layout === 1 || expandedSlot >= layout)) setExpandedSlot(null)
  }, [layout, expandedSlot])

  // Esc collapses an expanded pane.
  useEffect(() => {
    if (expandedSlot === null) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedSlot(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [expandedSlot])

  const handleNewSession = async () => {
    if (isAnyStreaming) {
      setStreamingNavBlocked(true)
      return
    }

    closeSummaryOverlayImmediate()
    const result = await newSession()
    if (!result.ok && result.code === 'session_limit') {
      setSessionLimitOpen(true)
    }
    setExpandedSlot(null)
  }

  const handleSelectSession = async (id: number) => {
    if (isAnyStreaming) {
      setStreamingNavBlocked(true)
      return
    }
    closeSummaryOverlayImmediate()
    await loadSession(id)
  }

  const handleDeleteSession = async (id: number) => {
    if (isAnyStreaming) {
      setStreamingNavBlocked(true)
      return
    }
    closeSummaryOverlayImmediate()
    await deleteSession(id)
    setExpandedSlot(null)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Restoring conversation…</span>
      </div>
    )
  }

  const expandedPane = expandedSlot !== null ? panes.find((p) => p.slot === expandedSlot) : null

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      {sidebarOpen && (
        <div className="w-[260px] shrink-0 flex flex-col h-full">
          <Sidebar
            sessions={sessions}
            currentSessionId={sessionId}
            onSelectSession={handleSelectSession}
            onNewSession={handleNewSession}
            onRenameSession={renameSession}
            onDeleteSession={handleDeleteSession}
            onOpenSettings={onOpenSettings}
            isLicenseActivated={isLicenseActivated}
            onOpenLicense={onOpenLicense}
          />
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Header */}
        <header className="shrink-0 border-b border-border h-14 px-3 flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={() => setSidebarOpen((o) => !o)}
            title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
          >
            {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </Button>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">
              {sessions.find((s) => s.id === sessionId)?.title ?? 'New conversation'}
            </p>
          </div>

          <LayoutSelector
            value={layout}
            onChange={setLayout}
            panes={populatedPanes}
            onApplySelection={applyVisibleSelection}
          />
        </header>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 relative overflow-hidden">
            <div className="absolute inset-0">
              {expandedPane ? (
                // Match the grid's enter animation when switching to a single expanded pane.
                <div className="h-full w-full animate-in fade-in-0 zoom-in-95 duration-200 ease-out">
                  <ModelPane
                    pane={expandedPane}
                    isExpanded
                    onToggleExpand={() => setExpandedSlot(null)}
                    onSelectModel={setPaneModel}
                    onAskOne={askOne}
                    onAbortPane={abortPane}
                  />
                </div>
              ) : (
                // Grid remounts on collapse — same fade/zoom as the expanded view above.
                <div
                  key={layout}
                  className="grid gap-0.5 bg-border h-full w-full animate-in fade-in-0 zoom-in-95 duration-200 ease-out"
                  style={{ gridTemplateColumns: `repeat(${COLS[layout]}, minmax(0, 1fr))`, gridAutoRows: '1fr' }}
                >
                  {visiblePanes.map((pane) => (
                    <ModelPane
                      key={pane.slot}
                      pane={pane}
                      isExpanded={false}
                      showFollowUp={layout > 1}
                      onToggleExpand={layout > 1 ? () => setExpandedSlot(pane.slot) : undefined}
                      onSelectModel={setPaneModel}
                      onAskOne={askOne}
                      onAbortPane={abortPane}
                    />
                  ))}
                </div>
              )}
            </div>

            {summaryOverlayMounted && (
              <SummaryOverlay
                open={summaryOverlayOpen}
                onOpenChange={(open) => {
                  if (!open) closeSummaryOverlay()
                }}
                models={savedModels}
                comparedPanes={comparedPanes}
                disabled={!showSummarizeTab}
                selectedOpenRouterModelId={summaryOpenRouterModelId}
                onSelectModel={handleSelectSummaryModel}
                content={summaryContent}
                streaming={summaryStreaming}
                onGenerate={generateSummary}
                onAbort={abortSummary}
              />
            )}
          </div>

          <div
            className={`shrink-0 border-t border-border px-4 pb-3 relative z-40 bg-background ${showSummarizeTabArea ? 'pt-4' : 'pt-3'
              }`}
          >
            {showSummarizeTabArea && (
              <SummaryTab open={summaryOverlayOpen} onClick={toggleSummaryOverlay} />
            )}
            <ChatBar
              value={composerValue}
              onValueChange={setComposerValue}
              activeCount={sendableCount}
              skippedCount={skippedCount}
              streaming={isAnyStreaming}
              locked={summaryOverlayMounted}
              onSend={(text) => {
                askAll(text)
                setComposerValue('')
              }}
              onAbort={abort}
            />
          </div>
        </div>
      </div>

      {streamingNavBlocked && (
        <GenerationInProgressDialog
          title={STREAMING_NAV_DIALOG.title}
          message={STREAMING_NAV_DIALOG.message}
          onClose={() => setStreamingNavBlocked(false)}
        />
      )}
      {sessionLimitOpen && (
        <SessionLimitModal
          onClose={() => setSessionLimitOpen(false)}
          onUpgrade={() => {
            setSessionLimitOpen(false)
            onOpenLicense()
          }}
        />
      )}
    </div>
  )
}
