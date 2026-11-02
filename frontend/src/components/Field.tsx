import type { InputHTMLAttributes } from 'react'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Field({ label, error, id, ...props }: FieldProps) {
  const inputId = id ?? props.name
  return (
    <div>
      <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-slate-300">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/30 aria-invalid:border-red-500"
        {...props}
      />
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div role="alert" className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">
      {message}
    </div>
  )
}

export function SubmitButton({ pending, children }: { pending: boolean; children: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-indigo-500 px-4 py-2 font-medium text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Please wait…' : children}
    </button>
  )
}
