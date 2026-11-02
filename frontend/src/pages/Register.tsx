import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { AuthLayout } from '../components/AuthLayout'
import { Field, FormError, SubmitButton } from '../components/Field'
import { ApiError } from '../lib/api'

type FieldErrors = Partial<Record<'email' | 'name' | 'password', string>>

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [pending, setPending] = useState(false)

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const password = String(form.get('password'))
    if (password !== form.get('confirm')) {
      setFieldErrors({ password: 'Passwords do not match' })
      return
    }

    setPending(true)
    setError(null)
    setFieldErrors({})
    try {
      await register(String(form.get('email')), String(form.get('name')), password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.details) {
        setFieldErrors(Object.fromEntries(Object.entries(err.details).map(([k, v]) => [k, v[0]])))
      } else {
        setError(err instanceof ApiError ? err.message : 'Could not reach the server')
      }
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start sketching with your team">
      <form onSubmit={onSubmit} className="space-y-4">
        <FormError message={error} />
        <Field label="Name" name="name" autoComplete="name" required maxLength={50} error={fieldErrors.name} autoFocus />
        <Field label="Email" name="email" type="email" autoComplete="email" required error={fieldErrors.email} />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          error={fieldErrors.password}
        />
        <Field label="Confirm password" name="confirm" type="password" autoComplete="new-password" required />
        <SubmitButton pending={pending}>Create account</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-indigo-400 hover:text-indigo-300">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
