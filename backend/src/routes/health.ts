import { Router } from 'express'
import { env } from '../config/env.js'
import { unauthorized } from '../lib/errors.js'
import { registry } from '../lib/metrics.js'
import { prisma } from '../lib/prisma.js'
import { extractBearer } from '../middleware/auth.js'

export const healthRouter = Router()

/** Liveness: the process is up. */
healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) })
})

/** Readiness: dependencies (the database) are reachable. */
healthRouter.get('/health/ready', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'ok' })
  } catch (err) {
    req.log.error({ err }, 'readiness check failed')
    res.status(503).json({ status: 'error', database: 'unreachable' })
  }
})

healthRouter.get('/metrics', async (req, res) => {
  if (env.METRICS_TOKEN && extractBearer(req.headers.authorization) !== env.METRICS_TOKEN) {
    throw unauthorized()
  }
  res.type(registry.contentType).send(await registry.metrics())
})
