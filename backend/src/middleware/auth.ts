import type { RequestHandler } from 'express'
import { unauthorized } from '../lib/errors.js'
import { verifyToken } from '../services/auth.js'

export function extractBearer(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) return null
  return header.slice('Bearer '.length).trim() || null
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = extractBearer(req.headers.authorization)
  if (!token) throw unauthorized('Missing bearer token')
  req.user = verifyToken(token)
  next()
}
