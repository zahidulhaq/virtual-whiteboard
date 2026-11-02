import { pino } from 'pino'
import { env, isProduction } from '../config/env.js'

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'whiteboard-api' },
  redact: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.passwordHash'],
  ...(isProduction || env.NODE_ENV === 'test'
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss' } } }),
})
