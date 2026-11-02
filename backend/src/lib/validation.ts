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

export const boardNameSchema = z.string().trim().min(1, 'Board name is required').max(80)

export const createBoardSchema = z.object({ name: boardNameSchema })

export const updateBoardSchema = z.object({ name: boardNameSchema })

export const joinBoardSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{6}$/, 'Room code must be 6 letters or digits'),
})

export const updateMemberSchema = z.object({ role: z.enum(['EDITOR', 'VIEWER']) })

export const listEventsQuerySchema = z.object({
  after: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(5_000).default(1_000),
})
