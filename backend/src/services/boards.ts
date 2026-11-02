import { randomInt } from 'node:crypto'
import { forbidden, notFound } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import type { BoardEventInput } from '../lib/shapes.js'
import { Prisma } from '../generated/prisma/client.js'
import type { BoardRole } from '../generated/prisma/enums.js'

// No 0/O or 1/I so codes are easy to read aloud.
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_CODE_LENGTH = 6

export function generateRoomCode(): string {
  let code = ''
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)]
  return code
}

export const canEdit = (role: BoardRole) => role === 'OWNER' || role === 'EDITOR'

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002'

export async function getRole(boardId: string, userId: string): Promise<BoardRole | null> {
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
    select: { role: true },
  })
  return member?.role ?? null
}

/** Resolves the caller's role, hiding boards they don't belong to behind a 404. */
export async function requireRole(boardId: string, userId: string, allowed?: BoardRole[]): Promise<BoardRole> {
  const role = await getRole(boardId, userId)
  if (!role) throw notFound('Board not found')
  if (allowed && !allowed.includes(role)) throw forbidden(`Requires role: ${allowed.join(' or ')}`)
  return role
}

export async function listBoards(userId: string) {
  const memberships = await prisma.boardMember.findMany({
    where: { userId },
    include: {
      board: {
        include: { owner: { select: { name: true } }, _count: { select: { members: true } } },
      },
    },
    orderBy: { board: { updatedAt: 'desc' } },
  })
  return memberships.map(({ role, board }) => ({
    id: board.id,
    name: board.name,
    roomCode: board.roomCode,
    role,
    ownerName: board.owner.name,
    memberCount: board._count.members,
    updatedAt: board.updatedAt,
  }))
}

export async function createBoard(userId: string, name: string) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const board = await prisma.board.create({
        data: {
          name,
          roomCode: generateRoomCode(),
          ownerId: userId,
          members: { create: { userId, role: 'OWNER' } },
        },
      })
      return { ...board, role: 'OWNER' as const }
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
    }
  }
  throw new Error('Could not allocate a unique room code')
}

export async function joinBoard(userId: string, roomCode: string) {
  const board = await prisma.board.findUnique({ where: { roomCode } })
  if (!board) throw notFound('No board with that room code')

  const member = await prisma.boardMember.upsert({
    where: { boardId_userId: { boardId: board.id, userId } },
    create: { boardId: board.id, userId, role: 'EDITOR' },
    update: {},
  })
  return { ...board, role: member.role }
}

export async function getBoard(boardId: string, userId: string) {
  const role = await requireRole(boardId, userId)
  const board = await prisma.board.findUniqueOrThrow({
    where: { id: boardId },
    include: {
      members: {
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  })
  return {
    id: board.id,
    name: board.name,
    roomCode: board.roomCode,
    ownerId: board.ownerId,
    createdAt: board.createdAt,
    updatedAt: board.updatedAt,
    role,
    members: board.members.map((m) => ({ ...m.user, role: m.role, joinedAt: m.joinedAt })),
  }
}

export async function renameBoard(boardId: string, userId: string, name: string) {
  await requireRole(boardId, userId, ['OWNER'])
  return prisma.board.update({ where: { id: boardId }, data: { name } })
}

export async function deleteBoard(boardId: string, userId: string) {
  await requireRole(boardId, userId, ['OWNER'])
  await prisma.board.delete({ where: { id: boardId } })
}

export async function updateMemberRole(boardId: string, actorId: string, memberId: string, role: 'EDITOR' | 'VIEWER') {
  await requireRole(boardId, actorId, ['OWNER'])
  const target = await getRole(boardId, memberId)
  if (!target) throw notFound('Member not found')
  if (target === 'OWNER') throw forbidden("The owner's role cannot be changed")
  return prisma.boardMember.update({
    where: { boardId_userId: { boardId, userId: memberId } },
    data: { role },
  })
}

/** Owners can remove anyone but themselves; everyone else can only leave. */
export async function removeMember(boardId: string, actorId: string, memberId: string) {
  const actorRole = await requireRole(boardId, actorId)
  if (actorId !== memberId && actorRole !== 'OWNER') throw forbidden('Only the owner can remove members')
  const target = await getRole(boardId, memberId)
  if (!target) throw notFound('Member not found')
  if (target === 'OWNER') throw forbidden('The owner cannot leave their own board')
  await prisma.boardMember.delete({ where: { boardId_userId: { boardId, userId: memberId } } })
}

export function serializeEvent(event: {
  seq: bigint
  type: string
  payload: unknown
  userId: string
  createdAt: Date
}) {
  return {
    seq: Number(event.seq),
    type: event.type,
    payload: event.payload,
    userId: event.userId,
    createdAt: event.createdAt,
  }
}

export type SerializedEvent = ReturnType<typeof serializeEvent>

export async function listEvents(boardId: string, userId: string, after: number, limit: number) {
  await requireRole(boardId, userId)
  const events = await prisma.boardEvent.findMany({
    where: { boardId, seq: { gt: BigInt(after) } },
    orderBy: { seq: 'asc' },
    take: limit,
  })
  return { events: events.map(serializeEvent), hasMore: events.length === limit }
}

export async function appendEvent(boardId: string, userId: string, input: BoardEventInput) {
  const [event] = await prisma.$transaction([
    prisma.boardEvent.create({
      data: { boardId, userId, type: input.type, payload: input.payload as Prisma.InputJsonValue },
    }),
    prisma.board.update({ where: { id: boardId }, data: { updatedAt: new Date() } }),
  ])
  return serializeEvent(event)
}
