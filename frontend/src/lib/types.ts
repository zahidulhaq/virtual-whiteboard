export type Role = 'OWNER' | 'EDITOR' | 'VIEWER'

export interface User {
  id: string
  email: string
  name: string
}

export interface BoardSummary {
  id: string
  name: string
  roomCode: string
  role: Role
  ownerName: string
  memberCount: number
  updatedAt: string
}

export interface BoardMember extends User {
  role: Role
  joinedAt: string
}

export interface BoardDetails {
  id: string
  name: string
  roomCode: string
  ownerId: string
  role: Role
  members: BoardMember[]
  createdAt: string
  updatedAt: string
}

export type ShapeKind = 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text'

export interface Shape {
  id: string
  kind: ShapeKind
  points: number[]
  color: string
  strokeWidth: number
  text?: string
}

export type BoardEventInput =
  | { type: 'SHAPE_ADD'; payload: { shape: Shape } }
  | { type: 'SHAPE_DELETE'; payload: { id: string } }
  | { type: 'CLEAR'; payload: Record<string, never> }

export type BoardEvent = BoardEventInput & {
  seq: number
  userId: string
  createdAt: string
}

export interface PresenceUser {
  userId: string
  name: string
  color: string
}
