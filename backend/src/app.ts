import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { apiLimiter, authLimiter } from './middleware/rateLimit.js'
import { requestLogger } from './middleware/requestLogger.js'
import { authRouter } from './routes/auth.js'
import { boardsRouter } from './routes/boards.js'
import { healthRouter } from './routes/health.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }))
  app.use(express.json({ limit: '100kb' }))
  app.use(requestLogger)

  app.use(healthRouter)
  app.use('/api', apiLimiter)
  app.use('/api/auth/login', authLimiter)
  app.use('/api/auth/register', authLimiter)
  app.use('/api/auth', authRouter)
  app.use('/api/boards', boardsRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
