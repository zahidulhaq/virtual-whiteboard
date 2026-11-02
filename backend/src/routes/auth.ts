import { Router } from 'express'
import { loginSchema, registerSchema } from '../lib/validation.js'
import { requireAuth } from '../middleware/auth.js'
import * as auth from '../services/auth.js'

export const authRouter = Router()

authRouter.post('/register', async (req, res) => {
  const input = registerSchema.parse(req.body)
  res.status(201).json(await auth.register(input))
})

authRouter.post('/login', async (req, res) => {
  const input = loginSchema.parse(req.body)
  res.json(await auth.login(input))
})

authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({ user: await auth.getUser(req.user!.id) })
})
