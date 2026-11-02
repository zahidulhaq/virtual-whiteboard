import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { api, socketUrl } from '../lib/api'
import { throttle } from '../lib/throttle'
import type { BoardEvent, BoardEventInput, Role, Shape } from '../lib/types'
import { buildShapes, mergeEvents } from './boardState'

export type SessionStatus = 'connecting' | 'loading' | 'ready' | 'offline' | 'error'

type Ack<T = object> = ({ ok: true } & T) | { ok: false; error: string }

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...record }
  delete copy[key]
  return copy
}

interface PendingEvent {
  id: number
  input: BoardEventInput
}

interface Options {
  boardId: string
  token: string
  /** Called when the user loses access (removed, or the board was deleted). */
  onAccessLost: (reason: string) => void
}

export function useBoardSession({ boardId, token, onAccessLost }: Options) {
  const [status, setStatus] = useState<SessionStatus>('connecting')
  const [error, setError] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [events, setEvents] = useState<BoardEvent[]>([])
  const [pending, setPending] = useState<PendingEvent[]>([])
  const [drafts, setDrafts] = useState<Record<string, Shape>>({})

  const socketRef = useRef<Socket | null>(null)
  const draftSender = useRef<((shape: Shape | null) => void) | null>(null)
  const pendingId = useRef(0)
  const onAccessLostRef = useRef(onAccessLost)
  useEffect(() => {
    onAccessLostRef.current = onAccessLost
  }, [onAccessLost])

  useEffect(() => {
    const socket = io(socketUrl, { auth: { token }, transports: ['websocket', 'polling'] })
    socketRef.current = socket
    const sendDraft = throttle((shape: Shape | null) => socket.emit('board:draft', { boardId, shape }), 40)
    draftSender.current = sendDraft

    // Live events that arrive while the history is loading are buffered and merged afterwards.
    let loading = true
    let buffered: BoardEvent[] = []

    socket.on('connect', async () => {
      setStatus('loading')
      loading = true
      buffered = []
      const ack: Ack<{ role: Role }> = await socket.emitWithAck('board:join', { boardId })
      if (!ack.ok) {
        setStatus('error')
        setError(ack.error)
        onAccessLostRef.current(ack.error)
        return
      }
      setRole(ack.role)
      try {
        const history = await api.listAllEvents(boardId)
        // A full reload on every (re)connect keeps us consistent after missed broadcasts.
        setEvents(mergeEvents(history, buffered))
        loading = false
        buffered = []
        setStatus('ready')
        setError(null)
      } catch {
        setStatus('error')
        setError('Could not load board history')
      }
    })

    socket.on('board:event', (event: BoardEvent) => {
      if (loading) buffered.push(event)
      else setEvents((list) => mergeEvents(list, [event]))
      if (event.type === 'SHAPE_ADD') {
        setDrafts((all) => (event.userId in all ? omit(all, event.userId) : all))
      }
    })

    socket.on('board:draft', ({ userId, shape }: { userId: string; shape: Shape | null }) => {
      setDrafts((all) => (shape ? { ...all, [userId]: shape } : omit(all, userId)))
    })

    socket.on('board:role', ({ role }: { role: Role | null }) => {
      if (role) setRole(role)
      else onAccessLostRef.current('You were removed from this board')
    })

    socket.on('board:deleted', () => onAccessLostRef.current('This board was deleted by its owner'))

    socket.on('disconnect', () => setStatus('offline'))

    socket.on('connect_error', (err) => {
      setStatus('offline')
      setError(err.message)
    })

    return () => {
      sendDraft.cancel()
      draftSender.current = null
      socket.removeAllListeners()
      socket.close()
      socketRef.current = null
    }
  }, [boardId, token])

  const emitEvent = useCallback(
    async (input: BoardEventInput) => {
      const socket = socketRef.current
      if (!socket) return
      // Apply optimistically, then swap in the server-confirmed event.
      const id = ++pendingId.current
      setPending((list) => [...list, { id, input }])
      try {
        const ack: Ack<{ event: BoardEvent }> = await socket.timeout(10_000).emitWithAck('board:event', { boardId, ...input })
        if (ack.ok) setEvents((list) => mergeEvents(list, [ack.event]))
        else setError(ack.error)
      } catch {
        setError('The server did not confirm your change')
      } finally {
        setPending((list) => list.filter((p) => p.id !== id))
      }
    },
    [boardId],
  )

  const sendDraft = useCallback((shape: Shape | null) => draftSender.current?.(shape), [])

  const shapes = useMemo(() => buildShapes([...events, ...pending.map((p) => p.input)]), [events, pending])

  return {
    status,
    error,
    clearError: () => setError(null),
    role,
    events,
    shapes,
    drafts,
    emitEvent,
    sendDraft,
  }
}
