import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { app } from './helpers.js'

describe('health and metrics', () => {
  it('reports liveness', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })

  it('reports readiness when the database is reachable', async () => {
    const res = await request(app).get('/health/ready')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', database: 'ok' })
  })

  it('exposes Prometheus metrics', async () => {
    await request(app).get('/health')
    const res = await request(app).get('/metrics')
    expect(res.status).toBe(200)
    expect(res.text).toContain('http_request_duration_seconds')
    expect(res.text).toContain('socket_connections')
  })

  it('echoes a request id header', async () => {
    const res = await request(app).get('/health').set('x-request-id', 'abc-123')
    expect(res.headers['x-request-id']).toBe('abc-123')
  })

  it('returns JSON 404s for unknown routes', async () => {
    const res = await request(app).get('/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({ error: 'Not found' })
  })
})
