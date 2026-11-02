import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import { z } from 'zod'
import { env } from '../config/env.js'
import { HttpError } from '../lib/errors.js'
import { logger } from '../lib/logger.js'
import { boardEventInputSchema, shapeSchema } from '../lib/shapes.js'
import { verifyToken, type AuthUser } from '../services/auth.js'
import * as boards from '../services/boards.js'
import type { BoardRole } from '../generated/prisma/enums.js'
import { colorFor, presence } from './presence.js'
import { TokenBucket } from './rateLimiter.js'

interface SocketData {
  user: AuthUser
  color: string
  /** Boards this socket has joined, with the role it was granted. */
  boards: Map<string, BoardRole>
  limits: { events: TokenBucket; realtime: TokenBucket }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Events = Record<string, (...args: any[]) => void>
type AppSocket = Socket<Events, Events, Events, SocketData>
type Ack = (response: { ok: true; [key: string]: unknown } | { ok: false; error: string }) => void

const room = (boardId: string) => `board:${boardId}`

const joinSchema = z.object({ boardId: z.string().min(1).max(64) })
const boardEventSchema = z.object({ boardId: z.string().min(1).max(64) }).and(boardEventInputSchema)
const draftSchema = z.object({ boardId: z.string().min(1).max(64), shape: shapeSchema.nullable() })
const cursorSchema = z.object({
  boardId: z.string().min(1).max(64),
  x: z.number().finite(),
  y: z.number().finite(),
})

let io: Server | undefined

export function getIo(): Server | undefined {
  return io
}

function toErrorMessage(err: unknown): string {
  if (err instanceof z.ZodError) return 'Invalid payload'
  if (err instanceof HttpError) return err.message
  return 'Internal server error'
}

/**
 * Wraps a handler so validation/permission failures are reported through the ack.
 * `limit` picks which token bucket the event draws from.
 */
function handler<T>(
  socket: AppSocket,
  name: string,
  limit: keyof SocketData['limits'],
  fn: (input: T, ack: Ack) => Promise<void> | void,
) {
  return async (input: T, ack?: Ack) => {
    const reply: Ack = typeof ack === 'function' ? ack : () => {}
    if (!socket.data.limits[limit].take()) {
      reply({ ok: false, error: 'Rate limit exceeded' })
      return
    }
    try {
      await fn(input, reply)
    } catch (err) {
      if (!(err instanceof HttpError) && !(err instanceof z.ZodError)) {
        logger.error({ err, event: name, userId: socket.data.user.id }, 'socket handler failed')
      }
      reply({ ok: false, error: toErrorMessage(err) })
    }
  }
}

function leaveBoard(socket: AppSocket, boardId: string) {
  socket.data.boards.delete(boardId)
  void socket.leave(room(boardId))
  presence.remove(boardId, socket.id)
  socket.to(room(boardId)).emit('cursor:leave', { userId: socket.data.user.id })
  io?.to(room(boardId)).emit('presence', presence.list(boardId))
}

function registerHandlers(socket: AppSocket) {
  const { user } = socket.data

  socket.on(
    'board:join',
    handler(socket, 'board:join', 'events', async (input, ack) => {
      const { boardId } = joinSchema.parse(input)
      const role = await boards.requireRole(boardId, user.id)
      socket.data.boards.set(boardId, role)
      await socket.join(room(boardId))
      presence.add(boardId, socket.id, { userId: user.id, name: user.name, color: socket.data.color })
      io?.to(room(boardId)).emit('presence', presence.list(boardId))
      ack({ ok: true, role, color: socket.data.color })
    }),
  )

  socket.on(
    'board:leave',
    handler(socket, 'board:leave', 'events', (input, ack) => {
      const { boardId } = joinSchema.parse(input)
      leaveBoard(socket, boardId)
      ack({ ok: true })
    }),
  )

  socket.on(
    'board:event',
    handler(socket, 'board:event', 'events', async (input, ack) => {
      const { boardId, ...event } = boardEventSchema.parse(input)
      if (!socket.data.boards.has(boardId)) throw new HttpError(403, 'Join the board first')
      // Re-check against the database so a demotion takes effect immediately.
      const role = await boards.requireRole(boardId, user.id)
      socket.data.boards.set(boardId, role)
      if (!boards.canEdit(role)) throw new HttpError(403, 'Viewers cannot edit this board')

      const saved = await boards.appendEvent(boardId, user.id, event)
      socket.to(room(boardId)).emit('board:event', saved)
      ack({ ok: true, event: saved })
    }),
  )

  // In-progress strokes are broadcast but never persisted.
  socket.on(
    'board:draft',
    handler(socket, 'board:draft', 'realtime', (input) => {
      const { boardId, shape } = draftSchema.parse(input)
      const role = socket.data.boards.get(boardId)
      if (!role || !boards.canEdit(role)) return
      socket.volatile.to(room(boardId)).emit('board:draft', { userId: user.id, shape })
    }),
  )

  socket.on(
    'cursor:move',
    handler(socket, 'cursor:move', 'realtime', (input) => {
      const { boardId, x, y } = cursorSchema.parse(input)
      if (!socket.data.boards.has(boardId)) return
      socket.volatile
        .to(room(boardId))
        .emit('cursor:move', { userId: user.id, name: user.name, color: socket.data.color, x, y })
    }),
  )

  socket.on('disconnecting', () => {
    for (const boardId of socket.data.boards.keys()) leaveBoard(socket, boardId)
  })
}

export function createSocketServer(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.CORS_ORIGIN, credentials: true },
    maxHttpBufferSize: 1_000_000,
  })

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token
      if (typeof token !== 'string') throw new HttpError(401, 'Missing token')
      const user = verifyToken(token)
      socket.data = {
        user,
        color: colorFor(user.id),
        boards: new Map(),
        limits: {
          // Committed shapes / joins: bursts of 40, ~15 per second sustained.
          events: new TokenBucket(40, 15),
          // Cursor + draft updates are throttled client-side to ~30/s.
          realtime: new TokenBucket(120, 60),
        },
      } satisfies SocketData
      next()
    } catch (err) {
      next(new Error(toErrorMessage(err)))
    }
  })

  io.on('connection', (socket: AppSocket) => {
    logger.debug({ userId: socket.data.user.id, socketId: socket.id }, 'socket connected')
    registerHandlers(socket)
  })

  return io
}

function socketsInBoard(boardId: string): AppSocket[] {
  const ids = io?.sockets.adapter.rooms.get(room(boardId)) ?? new Set<string>()
  return [...ids].map((id) => io!.sockets.sockets.get(id)).filter((s): s is AppSocket => s !== undefined)
}

/** Pushes membership changes made over REST to the affected user's sockets. */
export function notifyRoleChanged(boardId: string, userId: string, role: BoardRole | null) {
  for (const socket of socketsInBoard(boardId)) {
    if (socket.data.user.id !== userId) continue
    socket.emit('board:role', { boardId, role })
    if (role) socket.data.boards.set(boardId, role)
    else leaveBoard(socket, boardId)
  }
}

export function notifyBoardDeleted(boardId: string) {
  for (const socket of socketsInBoard(boardId)) {
    socket.emit('board:deleted', { boardId })
    leaveBoard(socket, boardId)
  }
}
