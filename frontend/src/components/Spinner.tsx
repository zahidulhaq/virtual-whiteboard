export function Spinner({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`${className} inline-block animate-spin rounded-full border-2 border-slate-500 border-t-indigo-400`}
    />
  )
}
