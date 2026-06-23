/**
 * The conversation-history sidebar (left rail). Lists past sessions under a
 * single "Recents" section, with inline rename and delete. Mirrors ChatGPT.
 */
import arcoLogo from '@/assets/arco-transparent.png'
import { LicenseBadge } from '@/components/license/LicenseBadge'
import { SettingsMenu } from '@/components/settings/SettingsMenu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getModelDef } from '@shared/models'
import type { SessionSummary } from '@shared/types'
import { Check, Pencil, Plus, Search, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  sessions: SessionSummary[]
  currentSessionId: number | null
  onSelectSession: (id: number) => void
  onNewSession: () => void
  onRenameSession: (id: number, title: string) => Promise<void>
  onDeleteSession: (id: number) => Promise<void>
  /** Opens the global settings/usage modal (footer gear menu). */
  onOpenSettings: () => void
  /** Whether Pro license is active on this device. */
  isLicenseActivated: boolean
  /** Opens the upgrade / license activation modal (free users only). */
  onOpenLicense: () => void
}

export function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  onOpenSettings,
  isLicenseActivated,
  onOpenLicense
}: Props) {
  const [searchQuery, setSearchQuery] = useState('')

  // Only show sessions that have actual content (a title or some models).
  const meaningful = sessions.filter((s) => s.title || s.models.length > 0)

  // Filter by search query if provided
  const filtered = searchQuery
    ? meaningful.filter((s) =>
      (s.title ?? 'New conversation').toLowerCase().includes(searchQuery.toLowerCase())
    )
    : meaningful

  return (
    <div className="flex flex-col h-full w-full bg-muted/30 border-r border-border">
      <div className="flex items-center gap-2 h-14 px-3 border-b border-border shrink-0">
        <img src={arcoLogo} alt="Arco" className="h-6 w-6 rounded-md shrink-0" />
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-sm font-semibold truncate leading-none">Arco</span>
          <LicenseBadge isActivated={isLicenseActivated} />
        </div>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onNewSession} title="New session">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Search bar - only show if there are conversations */}
      {meaningful.length > 0 && (
        <div className="px-3 py-2 border-b border-border shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-sm bg-background border border-border rounded-md outline-none focus:ring-1 focus:ring-ring"
              aria-label="Search conversations"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto py-2">
        {meaningful.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-8 px-3">Your conversations will appear here</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-8 px-3">No conversations found</p>
        ) : (
          <div className="mb-3">
            <p className="text-xs font-medium text-muted-foreground px-3 py-1">Recents</p>
            {filtered.map((session) => (
              <SessionItem
                key={session.id}
                session={session}
                isActive={session.id === currentSessionId}
                onClick={() => onSelectSession(session.id)}
                onRename={(title) => onRenameSession(session.id, title)}
                onDelete={() => onDeleteSession(session.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer: upgrade (free only) + global settings. */}
      <div className="px-2 py-2 border-t border-border shrink-0 space-y-1">
        {!isLicenseActivated && (
          <Button
            variant="ghost"
            className="h-8 w-full justify-start gap-2 px-2 text-sm text-muted-foreground hover:text-foreground"
            onClick={onOpenLicense}
            title="Upgrade to Pro"
          >
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>Upgrade to Pro</span>
          </Button>
        )}
        <SettingsMenu onOpenUsage={onOpenSettings} openUp labeled />
      </div>
    </div>
  )
}

/** A single session row, with hover actions for rename/delete. */
function SessionItem({
  session,
  isActive,
  onClick,
  onRename,
  onDelete
}: {
  session: SessionSummary
  isActive: boolean
  onClick: () => void
  onRename: (title: string) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [hovered, setHovered] = useState(false)
  const [badgesExpanded, setBadgesExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [deleting, setDeleting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const title = session.title ?? 'New conversation'

  const uniqueModels = session.models.filter(
    (m, i, arr) => arr.findIndex((x) => x.modelId === m.modelId) === i
  )

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setEditValue(title)
    setEditing(true)
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (!hovered) {
      setBadgesExpanded(false)
      return
    }
    const timer = window.setTimeout(() => setBadgesExpanded(true), 1500)
    return () => clearTimeout(timer)
  }, [hovered])

  async function commitEdit() {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== title) await onRename(trimmed)
    setEditing(false)
  }

  function cancelEdit() {
    setEditing(false)
  }

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    setDeleting(true)
    await onDelete()
    setDeleting(false)
  }

  return (
    <div
      className={cn(
        'relative group flex items-start gap-2 px-3 py-2 rounded-lg mx-1 transition-colors cursor-pointer',
        'hover:bg-muted',
        isActive && 'bg-primary/15'
      )}
      style={{ width: 'calc(100% - 8px)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !editing && onClick()}
    >
      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit()
                if (e.key === 'Escape') cancelEdit()
              }}
              className="flex-1 min-w-0 text-sm bg-background border border-border rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-ring"
            />
            <button onClick={commitEdit} className="shrink-0 text-emerald-600 hover:text-emerald-700">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={cancelEdit} className="shrink-0 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <p className="text-sm leading-snug truncate pr-12">{title}</p>
        )}

        {uniqueModels.length > 0 && (
          <div className={cn('flex flex-wrap gap-1 mt-1', hovered && 'pr-16')}>
            {uniqueModels.slice(0, 5).map((m) => {
              const def = getModelDef(m.modelId)
              return (
                <span
                  key={m.modelId}
                  className={cn(
                    'inline-flex items-center justify-center rounded-full shrink-0 transition-all duration-300 ease-in-out overflow-hidden',
                    def.color,
                    badgesExpanded ? 'px-2 py-0.5 max-w-full' : 'w-2 h-2 max-w-[8px]'
                  )}
                  title={m.label}
                >
                  <span
                    className={cn(
                      'text-xs font-medium text-white whitespace-nowrap transition-opacity duration-300',
                      badgesExpanded ? 'opacity-100' : 'opacity-0 w-0'
                    )}
                  >
                    {badgesExpanded ? m.label : ''}
                  </span>
                </span>
              )
            })}
            {uniqueModels.length > 5 && (
              <span className="text-xs text-muted-foreground">+{uniqueModels.length - 5}</span>
            )}
          </div>
        )}
      </div>

      {hovered && !editing && (
        <div
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={startEdit}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
            title="Rename"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-background transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}
