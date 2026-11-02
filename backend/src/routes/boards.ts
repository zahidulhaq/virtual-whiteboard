import { Router } from 'express'
import {
  createBoardSchema,
  joinBoardSchema,
  listEventsQuerySchema,
  updateBoardSchema,
  updateMemberSchema,
} from '../lib/validation.js'
import { requireAuth } from '../middleware/auth.js'
import { notifyBoardDeleted, notifyRoleChanged } from '../realtime/socket.js'
import * as boards from '../services/boards.js'

export const boardsRouter = Router()

boardsRouter.use(requireAuth)

boardsRouter.get('/', async (req, res) => {
  res.json({ boards: await boards.listBoards(req.user!.id) })
})

boardsRouter.post('/', async (req, res) => {
  const { name } = createBoardSchema.parse(req.body)
  res.status(201).json({ board: await boards.createBoard(req.user!.id, name) })
})

boardsRouter.post('/join', async (req, res) => {
  const { roomCode } = joinBoardSchema.parse(req.body)
  res.json({ board: await boards.joinBoard(req.user!.id, roomCode) })
})

boardsRouter.get('/:boardId', async (req, res) => {
  res.json({ board: await boards.getBoard(req.params.boardId, req.user!.id) })
})

boardsRouter.patch('/:boardId', async (req, res) => {
  const { name } = updateBoardSchema.parse(req.body)
  res.json({ board: await boards.renameBoard(req.params.boardId, req.user!.id, name) })
})

boardsRouter.delete('/:boardId', async (req, res) => {
  await boards.deleteBoard(req.params.boardId, req.user!.id)
  notifyBoardDeleted(req.params.boardId)
  res.status(204).end()
})

boardsRouter.patch('/:boardId/members/:userId', async (req, res) => {
  const { role } = updateMemberSchema.parse(req.body)
  const member = await boards.updateMemberRole(req.params.boardId, req.user!.id, req.params.userId, role)
  notifyRoleChanged(req.params.boardId, req.params.userId, role)
  res.json({ member })
})

boardsRouter.delete('/:boardId/members/:userId', async (req, res) => {
  await boards.removeMember(req.params.boardId, req.user!.id, req.params.userId)
  notifyRoleChanged(req.params.boardId, req.params.userId, null)
  res.status(204).end()
})

boardsRouter.get('/:boardId/events', async (req, res) => {
  const { after, limit } = listEventsQuerySchema.parse(req.query)
  res.json(await boards.listEvents(req.params.boardId, req.user!.id, after, limit))
})
