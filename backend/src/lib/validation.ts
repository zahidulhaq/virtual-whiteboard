import { z } from 'zod'

export const emailSchema = z.email().trim().toLowerCase().max(254)

export const registerSchema = z.object({
  email: emailSchema,
  name: z.string().trim().min(1, 'Name is required').max(50),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72),
})

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72),
})
