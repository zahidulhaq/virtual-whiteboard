import type { Role } from '../lib/types'

const styles: Record<Role, string> = {
  OWNER: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  EDITOR: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  VIEWER: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
}

export function RoleBadge({ role }: { role: Role }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[role]}`}>
      {role.toLowerCase()}
    </span>
  )
}
