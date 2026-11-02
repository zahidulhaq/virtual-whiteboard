import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Socket } from 'socket.io-client'
import {
  app,
  authed,
  createBoard,
  joinBoard,
  registerUser,
  sampleShape,
  startRealtimeServer,
  waitFor,
} from './helpers.js'

type Server = Awaited<ReturnType<typeof startRealtimeServer>>
let server: Server

beforeAll(async () => {
  server = await startRealtimeServer()
})

afterAll(async () => {
  await server.close()
})

async function connected(token: string): Promise<Socket> {
  const socket = server.connect(token)
  await waitFor(socket, 'connect')
  return socket
}

async function setup() {
  const owner = await registerUser('Owner')
  const guest = await registerUser('Guest')
  const board = await createBoard(owner)
  await joinBoard(guest, board.roomCode)
  const ownerSocket = await connected(owner.token)
  const guestSocket = await connected(guest.token)
  return { owner, guest, board, ownerSocket, guestSocket }
}

describe('realtime', () => {
  it('rejects connections without a valid token', async () => {
    const socket = server.connect('bad-token')
    const err = await waitFor<Error>(socket, 'connect_error')
    expect(err.message).toMatch(/invalid or expired token/i)
  })

  it('does not let non-members join a board', async () => {
    const { board } = await setup()
    const stranger = await registerUser('Stranger')
    const socket = await connected(stranger.token)
    const ack = await socket.emitWithAck('board:join', { boardId: board.id })
    expect(ack).toEqual({ ok: false, error: 'Board not found' })
  })

  it('broadcasts presence when users join and leave', async () => {
    const { board, ownerSocket, guestSocket } = await setup()
    await ownerSocket.emitWithAck('board:join', { boardId: board.id })

    const both = waitFor<{ name: string }[]>(ownerSocket, 'presence', (list) => list.length === 2)
    await guestSocket.emitWithAck('board:join', { boardId: board.id })
    expect((await both).map((u) => u.name).sort()).toEqual(['Guest', 'Owner'])

    const one = waitFor<{ name: string }[]>(ownerSocket, 'presence', (list) => list.length === 1)
    guestSocket.disconnect()
    expect((await one).map((u) => u.name)).toEqual(['Owner'])
  })

  it('persists and broadcasts drawing events in order', async () => {
    const { owner, board, ownerSocket, guestSocket } = await setup()
    await ownerSocket.emitWithAck('board:join', { boardId: board.id })
    await guestSocket.emitWithAck('board:join', { boardId: board.id })

    const shape = sampleShape()
    const received = waitFor<{ seq: number; type: string }>(guestSocket, 'board:event')
    const ack = await ownerSocket.emitWithAck('board:event', {
      boardId: board.id,
      type: 'SHAPE_ADD',
      payload: { shape },
    })
    expect(ack.ok).toBe(true)
    expect(await received).toMatchObject({ seq: ack.event.seq, type: 'SHAPE_ADD' })

    await ownerSocket.emitWithAck('board:event', { boardId: board.id, type: 'SHAPE_DELETE', payload: { id: shape.id } })
    await ownerSocket.emitWithAck('board:event', { boardId: board.id, type: 'CLEAR', payload: {} })

    const log = await request(app).get(`/api/boards/${board.id}/events`).set(authed(owner.token))
    expect(log.body.events.map((e: { type: string }) => e.type)).toEqual(['SHAPE_ADD', 'SHAPE_DELETE', 'CLEAR'])
    expect(log.body.events[0].payload.shape).toEqual(shape)

    const page = await request(app).get(`/api/boards/${board.id}/events?after=${ack.event.seq}&limit=1`).set(authed(owner.token))
    expect(page.body.events.map((e: { type: string }) => e.type)).toEqual(['SHAPE_DELETE'])
    expect(page.body.hasMore).toBe(true)
  })

  it('rejects invalid shapes', async () => {
    const { board, ownerSocket } = await setup()
    await ownerSocket.emitWithAck('board:join', { boardId: board.id })
    const ack = await ownerSocket.emitWithAck('board:event', {
      boardId: board.id,
      type: 'SHAPE_ADD',
      payload: { shape: { ...sampleShape(), points: [1, 2, 3], color: 'red' } },
    })
    expect(ack).toEqual({ ok: false, error: 'Invalid payload' })
  })

  it('requires joining before emitting', async () => {
    const { board, ownerSocket } = await setup()
    const ack = await ownerSocket.emitWithAck('board:event', { boardId: board.id, type: 'CLEAR', payload: {} })
    expect(ack.ok).toBe(false)
  })

  it('blocks viewers from editing and applies demotion immediately', async () => {
    const { owner, guest, board, ownerSocket, guestSocket } = await setup()
    await ownerSocket.emitWithAck('board:join', { boardId: board.id })
    await guestSocket.emitWithAck('board:join', { boardId: board.id })

    const before = await guestSocket.emitWithAck('board:event', {
      boardId: board.id,
      type: 'SHAPE_ADD',
      payload: { shape: sampleShape() },
    })
    expect(before.ok).toBe(true)

    const roleEvent = waitFor<{ role: string }>(guestSocket, 'board:role')
    await request(app)
      .patch(`/api/boards/${board.id}/members/${guest.id}`)
      .set(authed(owner.token))
      .send({ role: 'VIEWER' })
    expect((await roleEvent).role).toBe('VIEWER')

    const after = await guestSocket.emitWithAck('board:event', {
      boardId: board.id,
      type: 'SHAPE_ADD',
      payload: { shape: sampleShape() },
    })
    expect(after).toEqual({ ok: false, error: 'Viewers cannot edit this board' })
  })

  it('relays cursors and drafts to other members only', async () => {
    const { board, ownerSocket, guestSocket } = await setup()
    await ownerSocket.emitWithAck('board:join', { boardId: board.id })
    await guestSocket.emitWithAck('board:join', { boardId: board.id })

    const cursor = waitFor<{ name: string; x: number; y: number }>(guestSocket, 'cursor:move')
    ownerSocket.emit('cursor:move', { boardId: board.id, x: 12, y: 34 })
    expect(await cursor).toMatchObject({ name: 'Owner', x: 12, y: 34 })

    const draft = waitFor<{ shape: unknown }>(guestSocket, 'board:draft')
    const shape = sampleShape()
    ownerSocket.emit('board:draft', { boardId: board.id, shape })
    expect((await draft).shape).toEqual(shape)
  })

  it('notifies connected members when a board is deleted', async () => {
    const { owner, board, ownerSocket, guestSocket } = await setup()
    await ownerSocket.emitWithAck('board:join', { boardId: board.id })
    await guestSocket.emitWithAck('board:join', { boardId: board.id })

    const deleted = waitFor<{ boardId: string }>(guestSocket, 'board:deleted')
    await request(app).delete(`/api/boards/${board.id}`).set(authed(owner.token))
    expect((await deleted).boardId).toBe(board.id)
  })
})
