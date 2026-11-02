import type { RequestHandler } from 'express'
import { Counter, Gauge, Histogram, Registry, collectDefaultMetrics } from 'prom-client'
import { presence } from '../realtime/presence.js'

export const registry = new Registry()
registry.setDefaultLabels({ service: 'whiteboard-api' })
collectDefaultMetrics({ register: registry })

const httpDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5],
  registers: [registry],
})

export const boardEventsTotal = new Counter({
  name: 'board_events_total',
  help: 'Board events persisted, by type',
  labelNames: ['type'] as const,
  registers: [registry],
})

export const socketConnections = new Gauge({
  name: 'socket_connections',
  help: 'Currently connected Socket.IO clients',
  registers: [registry],
})

new Gauge({
  name: 'active_boards',
  help: 'Boards with at least one connected user',
  registers: [registry],
  collect() {
    this.set(presence.activeBoards)
  },
})

export const metricsMiddleware: RequestHandler = (req, res, next) => {
  const end = httpDuration.startTimer({ method: req.method })
  res.on('finish', () => {
    // Use the matched route pattern (e.g. /api/boards/:boardId) to keep label cardinality low.
    const route = req.route?.path ? `${req.baseUrl}${req.route.path}` : 'unmatched'
    end({ route, status: res.statusCode })
  })
  next()
}
