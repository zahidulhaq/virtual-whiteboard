import type Konva from 'konva'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Canvas } from '../board/Canvas'
import { MembersPanel } from '../board/MembersPanel'
import { PresenceBar } from '../board/PresenceBar'
import { RemoteCursors } from '../board/RemoteCursors'
import { Toolbar } from '../board/Toolbar'
import { TOOLS, type Tool } from '../board/tools'
import { useBoardSession, type SessionStatus } from '../board/useBoardSession'
import { zoomAround, type View } from '../board/view'
import { RoleBadge } from '../components/RoleBadge'
import { api } from '../lib/api'
import type { BoardDetails, Shape } from '../lib/types'

const statusLabel: Record<SessionStatus, { text: string; dot: string }> = {
  connecting: { text: 'Connecting…', dot: 'bg-amber-400' },
  loading: { text: 'Loading…', dot: 'bg-amber-400' },
  ready: { text: 'Live', dot: 'bg-emerald-500' },
  offline: { text: 'Reconnecting…', dot: 'bg-red-500' },
  error: { text: 'Error', dot: 'bg-red-500' },
}

export default function Board() {
  const { id: boardId = '' } = useParams<{ id: string }>()
  const { token, user } = useAuth()
  const navigate = useNavigate()
  const stageRef = useRef<Konva.Stage | null>(null)

  const [board, setBoard] = useState<BoardDetails | null>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#1e293b')
  const [strokeWidth, setStrokeWidth] = useState(4)
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 })
  const [myShapes, setMyShapes] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [panel, setPanel] = useState<'members' | null>(null)

  const onAccessLost = useCallback(
    (reason: string) => navigate('/dashboard', { replace: true, state: { notice: reason } }),
    [navigate],
  )

  const session = useBoardSession({ boardId, token: token!, onAccessLost })
  const role = session.role ?? board?.role ?? null
  const readOnly = role === 'VIEWER' || session.status !== 'ready'

  useEffect(() => {
    api
      .getBoard(boardId)
      .then(({ board }) => setBoard(board))
      .catch(() => onAccessLost('Board not found'))
  }, [boardId, onAccessLost])

  const commit = useCallback(
    (shape: Shape) => {
      setMyShapes((ids) => [...ids, shape.id])
      void session.emitEvent({ type: 'SHAPE_ADD', payload: { shape } })
    },
    [session],
  )

  const erase = useCallback(
    (id: string) => {
      if (!session.shapes.has(id)) return
      void session.emitEvent({ type: 'SHAPE_DELETE', payload: { id } })
    },
    [session],
  )

  const undo = useCallback(() => {
    // Undo only removes this user's own shapes that still exist on the board.
    const remaining = myShapes.filter((id) => session.shapes.has(id))
    const last = remaining.pop()
    setMyShapes(remaining)
    if (last) void session.emitEvent({ type: 'SHAPE_DELETE', payload: { id: last } })
  }, [myShapes, session])

  const clear = useCallback(() => {
    if (session.shapes.size === 0 || !confirm('Clear the whole board for everyone?')) return
    void session.emitEvent({ type: 'CLEAR', payload: {} })
  }, [session])

  const zoomBy = (factor: number) => {
    const stage = stageRef.current
    const center = { x: (stage?.width() ?? 0) / 2, y: (stage?.height() ?? 0) / 2 }
    setView((v) => zoomAround(v, center, v.scale * factor))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select')) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (!readOnly) undo()
        return
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const match = TOOLS.find((t) => t.shortcut === e.key.toLowerCase())
      if (match && (!readOnly || match.id === 'hand')) setTool(match.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [readOnly, undo])

  async function copyCode() {
    if (!board) return
    await navigator.clipboard.writeText(board.roomCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const status = statusLabel[session.status]

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <Canvas
        stageRef={stageRef}
        shapes={[...session.shapes.values()]}
        remoteDrafts={Object.values(session.drafts)}
        readOnly={readOnly}
        tool={role === 'VIEWER' ? 'hand' : tool}
        color={color}
        strokeWidth={strokeWidth}
        view={view}
        onViewChange={setView}
        onCommit={commit}
        onErase={erase}
        onDraft={session.sendDraft}
        onPointerMove={session.sendCursor}
        overlay={<RemoteCursors cursors={Object.values(session.cursors)} scale={view.scale} />}
      />

      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3">
        <div className="pointer-events-auto flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-lg">
          <Link to="/dashboard" className="text-slate-500 hover:text-slate-900" aria-label="Back to dashboard">
            ←
          </Link>
          <h1 className="truncate font-semibold text-slate-900">{board?.name ?? 'Loading…'}</h1>
          {role && <RoleBadge role={role} tone="light" />}
          {board && (
            <button
              onClick={copyCode}
              title="Copy room code"
              className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-sm tracking-widest text-slate-700 hover:bg-slate-200"
            >
              {copied ? 'Copied!' : board.roomCode}
            </button>
          )}
          <span className="hidden items-center gap-1.5 text-xs text-slate-500 sm:flex">
            <span className={`h-2 w-2 rounded-full ${status.dot}`} />
            {status.text}
          </span>
        </div>

        <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2 py-1.5 shadow-lg">
          <PresenceBar users={session.presence} selfId={user!.id} />
          <button
            onClick={() => setPanel((p) => (p === 'members' ? null : 'members'))}
            aria-pressed={panel === 'members'}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 aria-pressed:bg-slate-100"
          >
            Share
          </button>
        </div>
      </header>

      {panel === 'members' && board && (
        <div className="pointer-events-none absolute top-20 right-3">
          <MembersPanel
            board={{ ...board, role: role ?? board.role }}
            selfId={user!.id}
            online={session.presence}
            onClose={() => setPanel(null)}
            onBoardChange={setBoard}
          />
        </div>
      )}

      <div className="pointer-events-none absolute top-20 left-3">
        <Toolbar
          tool={role === 'VIEWER' ? 'hand' : tool}
          color={color}
          strokeWidth={strokeWidth}
          readOnly={role === 'VIEWER'}
          canUndo={myShapes.some((id) => session.shapes.has(id))}
          onTool={setTool}
          onColor={setColor}
          onStrokeWidth={setStrokeWidth}
          onUndo={undo}
          onClear={clear}
        />
      </div>

      <div className="absolute right-3 bottom-3 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 text-sm text-slate-700 shadow-lg">
        <button onClick={() => zoomBy(1 / 1.2)} className="h-8 w-8 rounded-lg hover:bg-slate-100" aria-label="Zoom out">
          −
        </button>
        <button
          onClick={() => setView({ x: 0, y: 0, scale: 1 })}
          className="h-8 min-w-14 rounded-lg px-2 tabular-nums hover:bg-slate-100"
          title="Reset view"
        >
          {Math.round(view.scale * 100)}%
        </button>
        <button onClick={() => zoomBy(1.2)} className="h-8 w-8 rounded-lg hover:bg-slate-100" aria-label="Zoom in">
          +
        </button>
      </div>

      {role === 'VIEWER' && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900 px-4 py-1.5 text-sm text-white shadow-lg">
          View only — ask the owner for edit access
        </div>
      )}

      {session.error && session.status !== 'error' && (
        <div
          role="alert"
          className="absolute bottom-16 left-1/2 flex -translate-x-1/2 items-center gap-3 rounded-lg bg-red-600 px-4 py-2 text-sm text-white shadow-lg"
        >
          {session.error}
          <button onClick={session.clearError} aria-label="Dismiss" className="opacity-80 hover:opacity-100">
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
