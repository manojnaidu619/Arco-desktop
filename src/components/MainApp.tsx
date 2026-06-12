/**
 * The main application screen: the history sidebar, a grid of model panes, and
 * the bottom bar (layout selector + full-width "ask all" composer).
 *
 * Conversation state lives in `useChat`; this component owns layout/UI state
 * (sidebar open, which pane is expanded) and arranges the grid.
 */
import { useEffect, useMemo, useState } from 'react'
import { useChat } from '@/hooks/useChat'
import { LayoutSelector } from '@/components/LayoutSelector'
import { ModelPane } from '@/components/ModelPane'
import { ChatBar } from '@/components/ChatBar'
import { Sidebar } from '@/components/Sidebar'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { Loader2, PanelLeftClose, PanelLeftOpen, Plus, Settings } from 'lucide-react'

/** How many grid columns each layout preset uses (rows then fill the height). */
const COLS: Record<number, number> = { 1: 1, 2: 2, 3: 3, 4: 2, 6: 3 }

interface Props {
  onOpenSettings: () => void
}

export function MainApp({ onOpenSettings }: Props) {
  const {
    panes,
    layout,
    sessionId,
    sessions,
    loading,
    setLayout,
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

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null)
  // The bottom composer's text is controlled here so an abort can restore the
  // just-sent message for editing.
  const [composerValue, setComposerValue] = useState('')

  const visiblePanes = useMemo(() => panes.slice(0, layout), [panes, layout])
  const activeCount = useMemo(() => visiblePanes.filter((p) => p.modelId).length, [visiblePanes])
  const isAnyStreaming = panes.some((p) => p.status === 'streaming')

  // Reset an out-of-range expansion when the layout shrinks.
  useEffect(() => {
    if (expandedSlot !== null && expandedSlot >= layout) setExpandedSlot(null)
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
    await newSession()
    setExpandedSlot(null)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Restoring session…</span>
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
            onSelectSession={loadSession}
            onNewSession={handleNewSession}
            onRenameSession={renameSession}
            onDeleteSession={async (id) => {
              await deleteSession(id)
              setExpandedSlot(null)
            }}
          />
        </div>
      )}

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 h-full">
        {/* Header */}
        <header className="shrink-0 border-b border-border px-3 py-2.5 flex items-center gap-2">
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

          <ThemeToggle />

          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={onOpenSettings}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0" onClick={handleNewSession}>
            <Plus className="h-3.5 w-3.5" />
            New
          </Button>
        </header>

        {/* Grid of panes (or a single expanded pane) */}
        <div className="flex-1 min-h-0 overflow-hidden p-3">
          {expandedPane ? (
            <ModelPane
              pane={expandedPane}
              isExpanded
              onToggleExpand={() => setExpandedSlot(null)}
              onSelectModel={setPaneModel}
              onAskOne={askOne}
              onAbortPane={abortPane}
            />
          ) : (
            <div
              // `key={layout}` re-mounts the grid on every layout change, which
              // re-triggers the tw-animate-css enter animation below — a subtle
              // fade + zoom as the panes reflow into the new grid.
              key={layout}
              className="grid gap-3 h-full animate-in fade-in-0 zoom-in-95 duration-200 ease-out"
              style={{ gridTemplateColumns: `repeat(${COLS[layout]}, minmax(0, 1fr))`, gridAutoRows: '1fr' }}
            >
              {visiblePanes.map((pane) => (
                <ModelPane
                  key={pane.slot}
                  pane={pane}
                  isExpanded={false}
                  onToggleExpand={() => setExpandedSlot(pane.slot)}
                  onSelectModel={setPaneModel}
                  onAskOne={askOne}
                  onAbortPane={abortPane}
                />
              ))}
            </div>
          )}
        </div>

        {/* Bottom bar: layout selector + full-width composer */}
        <div className="shrink-0 border-t border-border px-4 py-3 flex items-start gap-3">
          <LayoutSelector value={layout} onChange={setLayout} />
          <div className="flex-1 min-w-0">
            <ChatBar
              value={composerValue}
              onValueChange={setComposerValue}
              activeCount={activeCount}
              streaming={isAnyStreaming}
              onSend={(text) => {
                askAll(text)
                setComposerValue('')
              }}
              onAbort={() => setComposerValue(abort())}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
