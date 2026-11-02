import type { ErrorRequestHandler, RequestHandler } from 'express'
import { ZodError, z } from 'zod'
import { HttpError } from '../lib/errors.js'

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' })
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: 'Validation failed', details: z.flattenError(err).fieldErrors })
    return
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) })
    return
  }
  // Malformed JSON bodies from express.json()
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' })
    return
  }
  req.log.error({ err }, 'unhandled error')
  res.status(500).json({ error: 'Internal server error' })
}
