import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app, authed, createBoard, joinBoard, registerUser } from './helpers.js'

describe('boards', () => {
  it('creates a board with the creator as owner', async () => {
    const owner = await registerUser('Owner')
    const res = await request(app).post('/api/boards').set(authed(owner.token)).send({ name: '  Roadmap  ' })

    expect(res.status).toBe(201)
    expect(res.body.board).toMatchObject({ name: 'Roadmap', role: 'OWNER', ownerId: owner.id })
    expect(res.body.board.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })

  it('lists only boards the user belongs to', async () => {
    const owner = await registerUser('Owner')
    const stranger = await registerUser('Stranger')
    const board = await createBoard(owner)

    const mine = await request(app).get('/api/boards').set(authed(owner.token))
    expect(mine.body.boards.map((b: { id: string }) => b.id)).toContain(board.id)

    const theirs = await request(app).get('/api/boards').set(authed(stranger.token))
    expect(theirs.body.boards).toEqual([])
  })

  it('joins by room code (case-insensitive) as an editor, idempotently', async () => {
    const owner = await registerUser('Owner')
    const guest = await registerUser('Guest')
    const board = await createBoard(owner)

    const first = await joinBoard(guest, board.roomCode.toLowerCase())
    expect(first.status).toBe(200)
    expect(first.body.board).toMatchObject({ id: board.id, role: 'EDITOR' })

    const second = await joinBoard(guest, board.roomCode)
    expect(second.body.board.role).toBe('EDITOR')

    const details = await request(app).get(`/api/boards/${board.id}`).set(authed(owner.token))
    expect(details.body.board.members).toHaveLength(2)
  })

  it('rejects unknown and malformed room codes', async () => {
    const user = await registerUser()
    expect((await joinBoard(user, 'ZZZZZZ')).status).toBe(404)
    expect((await joinBoard(user, 'abc')).status).toBe(400)
  })

  it('hides boards from non-members', async () => {
    const owner = await registerUser('Owner')
    const stranger = await registerUser('Stranger')
    const board = await createBoard(owner)

    const res = await request(app).get(`/api/boards/${board.id}`).set(authed(stranger.token))
    expect(res.status).toBe(404)
    const events = await request(app).get(`/api/boards/${board.id}/events`).set(authed(stranger.token))
    expect(events.status).toBe(404)
  })

  it('lets only the owner rename, change roles and delete', async () => {
    const owner = await registerUser('Owner')
    const editor = await registerUser('Editor')
    const board = await createBoard(owner)
    await joinBoard(editor, board.roomCode)

    const forbiddenRename = await request(app)
      .patch(`/api/boards/${board.id}`)
      .set(authed(editor.token))
      .send({ name: 'Hijacked' })
    expect(forbiddenRename.status).toBe(403)

    const rename = await request(app).patch(`/api/boards/${board.id}`).set(authed(owner.token)).send({ name: 'Renamed' })
    expect(rename.body.board.name).toBe('Renamed')

    const selfPromote = await request(app)
      .patch(`/api/boards/${board.id}/members/${owner.id}`)
      .set(authed(editor.token))
      .send({ role: 'VIEWER' })
    expect(selfPromote.status).toBe(403)

    const demote = await request(app)
      .patch(`/api/boards/${board.id}/members/${editor.id}`)
      .set(authed(owner.token))
      .send({ role: 'VIEWER' })
    expect(demote.body.member.role).toBe('VIEWER')

    const ownerChange = await request(app)
      .patch(`/api/boards/${board.id}/members/${owner.id}`)
      .set(authed(owner.token))
      .send({ role: 'VIEWER' })
    expect(ownerChange.status).toBe(403)

    expect((await request(app).delete(`/api/boards/${board.id}`).set(authed(editor.token))).status).toBe(403)
    expect((await request(app).delete(`/api/boards/${board.id}`).set(authed(owner.token))).status).toBe(204)
    expect((await request(app).get(`/api/boards/${board.id}`).set(authed(owner.token))).status).toBe(404)
  })

  it('lets members leave and owners remove members', async () => {
    const owner = await registerUser('Owner')
    const a = await registerUser('A')
    const b = await registerUser('B')
    const board = await createBoard(owner)
    await joinBoard(a, board.roomCode)
    await joinBoard(b, board.roomCode)

    expect((await request(app).delete(`/api/boards/${board.id}/members/${b.id}`).set(authed(a.token))).status).toBe(403)
    expect((await request(app).delete(`/api/boards/${board.id}/members/${a.id}`).set(authed(a.token))).status).toBe(204)
    expect((await request(app).delete(`/api/boards/${board.id}/members/${b.id}`).set(authed(owner.token))).status).toBe(204)
    expect((await request(app).delete(`/api/boards/${board.id}/members/${owner.id}`).set(authed(owner.token))).status).toBe(403)

    const details = await request(app).get(`/api/boards/${board.id}`).set(authed(owner.token))
    expect(details.body.board.members.map((m: { id: string }) => m.id)).toEqual([owner.id])
  })
})
