import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { AuthLayout } from '../components/AuthLayout'
import { Field, FormError, SubmitButton } from '../components/Field'
import { ApiError } from '../lib/api'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    setPending(true)
    setError(null)
    try {
      await login(String(form.get('email')), String(form.get('password')))
      const from = (location.state as { from?: string } | null)?.from
      navigate(from ?? '/dashboard', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reach the server')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to your whiteboards">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Email" name="email" type="email" autoComplete="email" required autoFocus />
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <SubmitButton pending={pending}>Sign in</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        New here?{' '}
        <Link to="/register" className="font-medium text-indigo-400 hover:text-indigo-300">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  )
}
