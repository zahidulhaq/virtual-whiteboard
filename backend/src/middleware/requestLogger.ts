import { randomUUID } from 'node:crypto'
import { pinoHttp } from 'pino-http'
import { logger } from '../lib/logger.js'

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const incoming = req.headers['x-request-id']
    const id = typeof incoming === 'string' && incoming.length <= 128 ? incoming : randomUUID()
    res.setHeader('x-request-id', id)
    return id
  },
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return 'error'
    if (res.statusCode >= 400) return 'warn'
    return 'info'
  },
  autoLogging: { ignore: (req) => req.url === '/health' || req.url === '/metrics' },
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
})
