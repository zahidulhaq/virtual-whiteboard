import { useEffect, useState } from 'react'
import { RoleBadge } from '../components/RoleBadge'
import { ApiError, api } from '../lib/api'
import type { BoardDetails, PresenceUser, Role } from '../lib/types'

interface Props {
  board: BoardDetails
  selfId: string
  online: PresenceUser[]
  onClose: () => void
  onBoardChange: (board: BoardDetails) => void
}

export function MembersPanel({ board, selfId, online, onClose, onBoardChange }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState(board.name)
  const isOwner = board.role === 'OWNER'
  const onlineIds = new Set(online.map((u) => u.userId))
  const onlineKey = [...onlineIds].sort().join(',')

  // Refresh membership when the panel opens and whenever someone new comes online.
  useEffect(() => {
    let cancelled = false
    api
      .getBoard(board.id)
      .then(({ board }) => !cancelled && onBoardChange(board))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [board.id, onlineKey, onBoardChange])

  async function run(action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
      onBoardChange((await api.getBoard(board.id)).board)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong')
    }
  }

  const changeRole = (userId: string, role: Exclude<Role, 'OWNER'>) =>
    run(() => api.updateMemberRole(board.id, userId, role))

  const remove = (userId: string, memberName: string) => {
    if (confirm(`Remove ${memberName} from this board?`)) void run(() => api.removeMember(board.id, userId))
  }

  const rename = () => {
    const trimmed = name.trim()
    if (trimmed && trimmed !== board.name) void run(() => api.renameBoard(board.id, trimmed))
  }

  return (
    <aside
      aria-label="Board members"
      className="pointer-events-auto flex max-h-[calc(100vh-6rem)] w-80 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 className="font-semibold">Board settings</h2>
        <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-900">
          ✕
        </button>
      </div>

      <div className="space-y-4 overflow-y-auto p-4">
        {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {isOwner && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              rename()
            }}
          >
            <label htmlFor="board-name" className="mb-1 block text-xs font-medium tracking-wide text-slate-500 uppercase">
              Name
            </label>
            <div className="flex gap-2">
              <input
                id="board-name"
                value={name}
                maxLength={80}
                onChange={(e) => setName(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2 py-1 text-sm outline-none focus:border-indigo-500"
              />
              <button className="rounded-lg bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-700">Save</button>
            </div>
          </form>
        )}

        <div>
          <p className="mb-1 text-xs font-medium tracking-wide text-slate-500 uppercase">Invite</p>
          <p className="text-sm text-slate-600">
            Share room code <span className="font-mono font-semibold tracking-widest">{board.roomCode}</span>. New members
            join as editors{isOwner ? '; change their role below.' : '.'}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
            Members ({board.members.length})
          </p>
          <ul className="space-y-2">
            {board.members.map((member) => (
              <li key={member.id} className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${onlineIds.has(member.id) ? 'bg-emerald-500' : 'bg-slate-300'}`}
                  title={onlineIds.has(member.id) ? 'Online' : 'Offline'}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.name}
                    {member.id === selfId && <span className="font-normal text-slate-500"> (you)</span>}
                  </p>
                  <p className="truncate text-xs text-slate-500">{member.email}</p>
                </div>
                {isOwner && member.role !== 'OWNER' ? (
                  <>
                    <select
                      aria-label={`Role for ${member.name}`}
                      value={member.role}
                      onChange={(e) => changeRole(member.id, e.target.value as Exclude<Role, 'OWNER'>)}
                      className="rounded-md border border-slate-300 bg-white px-1 py-0.5 text-xs"
                    >
                      <option value="EDITOR">Editor</option>
                      <option value="VIEWER">Viewer</option>
                    </select>
                    <button
                      onClick={() => remove(member.id, member.name)}
                      aria-label={`Remove ${member.name}`}
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <RoleBadge role={member.role} tone="light" />
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </aside>
  )
}
