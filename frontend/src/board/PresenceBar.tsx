import type { PresenceUser } from '../lib/types'

const MAX_SHOWN = 5

export function PresenceBar({ users, selfId }: { users: PresenceUser[]; selfId: string }) {
  // Show the current user first.
  const sorted = [...users].sort((a, b) => Number(b.userId === selfId) - Number(a.userId === selfId))
  const shown = sorted.slice(0, MAX_SHOWN)
  const hidden = sorted.length - shown.length

  return (
    <div className="flex items-center -space-x-2" aria-label={`${users.length} online`}>
      {shown.map((user) => (
        <span
          key={user.userId}
          title={user.userId === selfId ? `${user.name} (you)` : user.name}
          className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white ring-2 ring-white"
          style={{ backgroundColor: user.color }}
        >
          {user.name.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {hidden > 0 && (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-xs font-medium text-slate-700 ring-2 ring-white">
          +{hidden}
        </span>
      )}
    </div>
  )
}
