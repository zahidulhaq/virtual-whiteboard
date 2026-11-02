import { rateLimit } from 'express-rate-limit'
import { env } from '../config/env.js'

const skip = () => env.NODE_ENV === 'test'

/** Brute-force protection for login/register. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Too many attempts, please try again later' },
  skip,
})

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests, slow down' },
  skip,
})
