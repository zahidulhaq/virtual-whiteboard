import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import { io as connect, type Socket } from 'socket.io-client'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { createSocketServer } from '../src/realtime/socket.js'

export const app = createApp()

export interface TestUser {
  id: string
  email: string
  name: string
  token: string
}

export async function registerUser(name = 'Tester'): Promise<TestUser> {
  const email = `${name.toLowerCase()}-${randomUUID()}@example.com`
  const res = await request(app).post('/api/auth/register').send({ email, name, password: 'password123' })
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`)
  return { ...res.body.user, token: res.body.token }
}

export const authed = (token: string) => ({ Authorization: `Bearer ${token}` })

export async function createBoard(owner: TestUser, name = 'Test board') {
  const res = await request(app).post('/api/boards').set(authed(owner.token)).send({ name })
  return res.body.board as { id: string; roomCode: string; name: string }
}

export async function joinBoard(user: TestUser, roomCode: string) {
  return request(app).post('/api/boards/join').set(authed(user.token)).send({ roomCode })
}

/** Starts the HTTP + Socket.IO server on a random port. */
export async function startRealtimeServer() {
  const server: Server = createServer(app)
  const io = createSocketServer(server)
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const sockets: Socket[] = []

  return {
    url,
    connect(token: string) {
      const socket = connect(url, { auth: { token }, transports: ['websocket'], forceNew: true })
      sockets.push(socket)
      return socket
    },
    async close() {
      sockets.forEach((socket) => socket.close())
      await io.close()
    },
  }
}

export function waitFor<T>(socket: Socket, event: string, predicate: (payload: T) => boolean = () => true) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timed out waiting for ${event}`)), 3_000)
    const listener = (payload: T) => {
      if (!predicate(payload)) return
      clearTimeout(timer)
      socket.off(event, listener)
      resolve(payload)
    }
    socket.on(event, listener)
  })
}

export const sampleShape = (id = randomUUID()) => ({
  id,
  kind: 'pen' as const,
  points: [0, 0, 10, 10, 20, 5],
  color: '#1e293b',
  strokeWidth: 4,
})
