import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, tokenStore } from '../lib/api'
import type { User } from '../lib/types'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, name: string, password: string) => Promise<void>
  logout: () => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(tokenStore.get)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(token !== null)

  useEffect(() => {
    if (!token || user) return
    let cancelled = false
    api
      .me()
      .then(({ user }) => !cancelled && setUser(user))
      .catch(() => {
        if (cancelled) return
        tokenStore.clear()
        setToken(null)
      })
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [token, user])

  const acceptSession = useCallback((session: { user: User; token: string }) => {
    tokenStore.set(session.token)
    setToken(session.token)
    setUser(session.user)
    setLoading(false)
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      user,
      token,
      loading,
      login: async (email, password) => acceptSession(await api.login({ email, password })),
      register: async (email, name, password) => acceptSession(await api.register({ email, name, password })),
      logout: () => {
        tokenStore.clear()
        setToken(null)
        setUser(null)
      },
    }),
    [user, token, loading, acceptSession],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
