import type { BoardDetails, BoardEvent, BoardSummary, Role, User } from './types'

const API_URL = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'whiteboard.token'

export class ApiError extends Error {
  readonly status: number
  readonly details?: Record<string, string[]>

  constructor(status: number, message: string, details?: Record<string, string[]>) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get()
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  })

  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, body.error ?? res.statusText, body.details)
  return body as T
}

const post = <T>(path: string, data?: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(data ?? {}) })
const patch = <T>(path: string, data: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data) })
const del = (path: string) => request<void>(path, { method: 'DELETE' })

type AuthResponse = { user: User; token: string }

export const api = {
  register: (data: { email: string; name: string; password: string }) => post<AuthResponse>('/api/auth/register', data),
  login: (data: { email: string; password: string }) => post<AuthResponse>('/api/auth/login', data),
  me: () => request<{ user: User }>('/api/auth/me'),

  listBoards: () => request<{ boards: BoardSummary[] }>('/api/boards'),
  createBoard: (name: string) => post<{ board: BoardSummary }>('/api/boards', { name }),
  joinBoard: (roomCode: string) => post<{ board: BoardSummary }>('/api/boards/join', { roomCode }),
  getBoard: (id: string) => request<{ board: BoardDetails }>(`/api/boards/${id}`),
  renameBoard: (id: string, name: string) => patch<{ board: BoardSummary }>(`/api/boards/${id}`, { name }),
  deleteBoard: (id: string) => del(`/api/boards/${id}`),
  updateMemberRole: (boardId: string, userId: string, role: Exclude<Role, 'OWNER'>) =>
    patch(`/api/boards/${boardId}/members/${userId}`, { role }),
  removeMember: (boardId: string, userId: string) => del(`/api/boards/${boardId}/members/${userId}`),

  /** Loads the full event log, following pagination. */
  async listAllEvents(boardId: string): Promise<BoardEvent[]> {
    const events: BoardEvent[] = []
    let after = 0
    for (;;) {
      const page = await request<{ events: BoardEvent[]; hasMore: boolean }>(
        `/api/boards/${boardId}/events?after=${after}&limit=5000`,
      )
      events.push(...page.events)
      if (!page.hasMore || page.events.length === 0) return events
      after = page.events[page.events.length - 1]!.seq
    }
  },
}

export const socketUrl = API_URL || undefined
