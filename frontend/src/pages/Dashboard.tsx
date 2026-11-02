import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { FormError } from '../components/Field'
import { RoleBadge } from '../components/RoleBadge'
import { Spinner } from '../components/Spinner'
import { ApiError, api } from '../lib/api'
import { timeAgo } from '../lib/format'
import type { BoardSummary } from '../lib/types'

const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong')

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const notice = (useLocation().state as { notice?: string } | null)?.notice
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<'create' | 'join' | null>(null)

  const load = useCallback(async () => {
    try {
      setBoards((await api.listBoards()).boards)
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch on mount
    void load()
  }, [load])

  async function onCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const name = String(new FormData(e.currentTarget).get('name')).trim()
    if (!name) return
    setPending('create')
    setError(null)
    try {
      const { board } = await api.createBoard(name)
      navigate(`/board/${board.id}`)
    } catch (err) {
      setError(errorMessage(err))
      setPending(null)
    }
  }

  async function onJoin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const code = String(new FormData(e.currentTarget).get('code')).trim()
    if (!code) return
    setPending('join')
    setError(null)
    try {
      const { board } = await api.joinBoard(code)
      navigate(`/board/${board.id}`)
    } catch (err) {
      setError(errorMessage(err))
      setPending(null)
    }
  }

  async function onRemove(board: BoardSummary) {
    const owner = board.role === 'OWNER'
    const question = owner
      ? `Delete "${board.name}" for everyone? This cannot be undone.`
      : `Leave "${board.name}"? You can rejoin with the room code.`
    if (!confirm(question)) return
    try {
      if (owner) await api.deleteBoard(board.id)
      else await api.removeMember(board.id, user!.id)
      setBoards((list) => list?.filter((b) => b.id !== board.id) ?? null)
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500">✎</span>
            Virtual Whiteboard
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-slate-400 sm:inline">{user?.name}</span>
            <button onClick={logout} className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-slate-800">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
        {notice && (
          <div className="rounded-lg border border-amber-900 bg-amber-950/50 px-3 py-2 text-sm text-amber-200">{notice}</div>
        )}
        <FormError message={error} />

        <section className="grid gap-4 md:grid-cols-2">
          <form onSubmit={onCreate} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">New board</h2>
            <p className="mb-4 text-sm text-slate-400">Start a fresh canvas and invite others with its room code.</p>
            <div className="flex gap-2">
              <input
                name="name"
                aria-label="Board name"
                placeholder="e.g. Sprint retro"
                maxLength={80}
                required
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 outline-none focus:border-indigo-400"
              />
              <button
                disabled={pending !== null}
                className="rounded-lg bg-indigo-500 px-4 py-2 font-medium hover:bg-indigo-400 disabled:opacity-60"
              >
                {pending === 'create' ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>

          <form onSubmit={onJoin} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="font-semibold">Join with a room code</h2>
            <p className="mb-4 text-sm text-slate-400">Ask the board owner for its 6-character code.</p>
            <div className="flex gap-2">
              <input
                name="code"
                aria-label="Room code"
                placeholder="ABC123"
                maxLength={6}
                required
                pattern="[A-Za-z0-9]{6}"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono uppercase tracking-widest outline-none focus:border-indigo-400"
              />
              <button
                disabled={pending !== null}
                className="rounded-lg border border-slate-600 px-4 py-2 font-medium hover:bg-slate-800 disabled:opacity-60"
              >
                {pending === 'join' ? 'Joining…' : 'Join'}
              </button>
            </div>
          </form>
        </section>

        <section>
          <h1 className="mb-4 text-xl font-semibold">Your boards</h1>
          {boards === null ? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          ) : boards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-800 py-12 text-center text-slate-400">
              No boards yet — create one or join with a room code.
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {boards.map((board) => (
                <li key={board.id} className="group relative rounded-2xl border border-slate-800 bg-slate-900 p-5 hover:border-slate-600">
                  <Link to={`/board/${board.id}`} className="absolute inset-0 rounded-2xl" aria-label={`Open ${board.name}`} />
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="truncate font-medium">{board.name}</h3>
                    <RoleBadge role={board.role} />
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    by {board.ownerName} · {board.memberCount} member{board.memberCount === 1 ? '' : 's'}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
                    <span className="font-mono tracking-widest">{board.roomCode}</span>
                    <span>edited {timeAgo(board.updatedAt)}</span>
                  </div>
                  <button
                    onClick={() => onRemove(board)}
                    className="relative z-10 mt-3 text-xs text-slate-500 opacity-0 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                  >
                    {board.role === 'OWNER' ? 'Delete board' : 'Leave board'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}
