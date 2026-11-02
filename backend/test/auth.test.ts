import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app, authed, registerUser } from './helpers.js'

describe('auth', () => {
  it('registers a user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'New.User@Example.com', name: 'New User', password: 'password123' })

    expect(res.status).toBe(201)
    expect(res.body.user).toMatchObject({ email: 'new.user@example.com', name: 'New User' })
    expect(res.body.user).not.toHaveProperty('passwordHash')
    expect(res.body.token).toEqual(expect.any(String))
  })

  it('rejects duplicate emails', async () => {
    const user = await registerUser()
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: user.email, name: 'Again', password: 'password123' })
    expect(res.status).toBe(409)
  })

  it('validates input', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'nope', name: '', password: 'short' })
    expect(res.status).toBe(400)
    expect(Object.keys(res.body.details)).toEqual(expect.arrayContaining(['email', 'name', 'password']))
  })

  it('logs in with valid credentials only', async () => {
    const user = await registerUser()
    const ok = await request(app).post('/api/auth/login').send({ email: user.email, password: 'password123' })
    expect(ok.status).toBe(200)
    expect(ok.body.user.id).toBe(user.id)

    const bad = await request(app).post('/api/auth/login').send({ email: user.email, password: 'wrong-password' })
    expect(bad.status).toBe(401)

    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'missing@example.com', password: 'password123' })
    expect(unknown.status).toBe(401)
    expect(unknown.body.error).toBe(bad.body.error)
  })

  it('returns the current user for a valid token', async () => {
    const user = await registerUser()
    const res = await request(app).get('/api/auth/me').set(authed(user.token))
    expect(res.status).toBe(200)
    expect(res.body.user).toEqual({ id: user.id, email: user.email, name: user.name })
  })

  it('rejects missing and invalid tokens', async () => {
    expect((await request(app).get('/api/auth/me')).status).toBe(401)
    expect((await request(app).get('/api/auth/me').set(authed('garbage'))).status).toBe(401)
  })
})
