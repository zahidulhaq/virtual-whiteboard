import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import type { SignOptions } from 'jsonwebtoken'
import { env } from '../config/env.js'
import { conflict, unauthorized } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'

const BCRYPT_ROUNDS = 12
// Compared against when the email is unknown so login timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS)

export interface AuthUser {
  id: string
  email: string
  name: string
}

interface TokenPayload {
  sub: string
  email: string
  name: string
}

export function signToken(user: AuthUser): string {
  const payload: TokenPayload = { sub: user.id, email: user.email, name: user.name }
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] })
}

export function verifyToken(token: string): AuthUser {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as TokenPayload
    return { id: payload.sub, email: payload.email, name: payload.name }
  } catch {
    throw unauthorized('Invalid or expired token')
  }
}

const toAuthUser = ({ id, email, name }: AuthUser): AuthUser => ({ id, email, name })

export async function register(input: { email: string; name: string; password: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } })
  if (existing) throw conflict('Email is already registered')

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
  const user = await prisma.user.create({
    data: { email: input.email, name: input.name, passwordHash },
  })
  return { user: toAuthUser(user), token: signToken(user) }
}

export async function login(input: { email: string; password: string }) {
  const user = await prisma.user.findUnique({ where: { email: input.email } })
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH)
  if (!user || !valid) throw unauthorized('Invalid email or password')
  return { user: toAuthUser(user), token: signToken(user) }
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } })
  if (!user) throw unauthorized('User no longer exists')
  return toAuthUser(user)
}
