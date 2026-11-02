import type { Role } from '../lib/types'

const dark: Record<Role, string> = {
  OWNER: 'bg-amber-500/15 text-amber-300 ring-amber-500/30',
  EDITOR: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/30',
  VIEWER: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
}

const light: Record<Role, string> = {
  OWNER: 'bg-amber-50 text-amber-700 ring-amber-200',
  EDITOR: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  VIEWER: 'bg-slate-100 text-slate-600 ring-slate-200',
}

export function RoleBadge({ role, tone = 'dark' }: { role: Role; tone?: 'dark' | 'light' }) {
  const styles = tone === 'dark' ? dark : light
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[role]}`}>
      {role.toLowerCase()}
    </span>
  )
}
