/**
 * The conversation-history sidebar (left rail). Lists past sessions grouped by
 * recency, with inline rename and delete. Mirrors the ChatGPT-style sidebar.
 */
import { useEffect, useRef, useState } from 'react'
import type { SessionSummary } from '@shared/types'
import { getModelDef } from '@shared/models'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { BrainCircuit, Check, MessageSquare, Pencil, Plus, Trash2, X } from 'lucide-react'

interface Props {
  sessions: SessionSummary[]
  currentSessionId: number | null
  onSelectSession: (id: number) => void
  onNewSession: () => void
  onRenameSession: (id: number, title: string) => Promise<void>
  onDeleteSession: (id: number) => Promise<void>
}

/** Human-friendly relative date used to group sessions. */
function relativeDate(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function groupSessions(sessions: SessionSummary[]) {
  const groups: Record<string, SessionSummary[]> = {}
  for (const s of sessions) {
    const label = relativeDate(s.updatedAt)
    if (!groups[label]) groups[label] = []
    groups[label].push(s)
  }
  return groups
}

export function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onDeleteSession
}: Props) {
  // Only show sessions that have actual content (a title or some models).
  const meaningful = sessions.filter((s) => s.title || s.models.length > 0)
  const groups = groupSessions(meaningful)
  const groupKeys = Object.keys(groups)

  return (
    <div className="flex flex-col h-full w-full bg-muted/30 border-r border-border">
      <div className="flex items-center gap-2 h-14 px-3 border-b border-border shrink-0">
        <BrainCircuit className="h-5 w-5 text-primary shrink-0" />
        <span className="text-sm font-semibold flex-1 truncate">Multi-Mind</span>
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onNewSession} title="New session">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {meaningful.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-8 px-3">Your conversations will appear here.</p>
        ) : (
          groupKeys.map((group) => (
            <div key={group} className="mb-3">
              <p className="text-xs font-medium text-muted-foreground px-3 py-1">{group}</p>
              {groups[group].map((session) => (
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
          ))
        )}
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
        isActive && 'bg-muted'
      )}
      style={{ width: 'calc(100% - 8px)' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => !editing && onClick()}
    >
      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />

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
          <div className="flex flex-wrap gap-1 mt-1">
            {uniqueModels.slice(0, 5).map((m) => {
              const def = getModelDef(m.modelId)
              return (
                <span
                  key={m.modelId}
                  className={cn('inline-block w-2 h-2 rounded-full shrink-0', def.color)}
                  title={m.label}
                />
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
