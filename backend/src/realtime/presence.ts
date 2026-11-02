export interface PresenceUser {
  userId: string
  name: string
  color: string
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899']

export function colorFor(userId: string): string {
  let hash = 0
  for (const char of userId) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return COLORS[hash % COLORS.length]!
}

/**
 * In-memory presence per board. A user may have several tabs open, so we
 * track sockets and de-duplicate by user when listing.
 * Note: this is per-process; running multiple API instances would need the
 * Socket.IO Redis adapter and a shared presence store.
 */
class PresenceStore {
  private boards = new Map<string, Map<string, PresenceUser>>()

  add(boardId: string, socketId: string, user: PresenceUser) {
    let sockets = this.boards.get(boardId)
    if (!sockets) this.boards.set(boardId, (sockets = new Map()))
    sockets.set(socketId, user)
  }

  remove(boardId: string, socketId: string) {
    const sockets = this.boards.get(boardId)
    if (!sockets) return
    sockets.delete(socketId)
    if (sockets.size === 0) this.boards.delete(boardId)
  }

  list(boardId: string): PresenceUser[] {
    const unique = new Map<string, PresenceUser>()
    for (const user of this.boards.get(boardId)?.values() ?? []) unique.set(user.userId, user)
    return [...unique.values()]
  }

  get activeBoards() {
    return this.boards.size
  }

  get activeConnections() {
    let total = 0
    for (const sockets of this.boards.values()) total += sockets.size
    return total
  }
}

export const presence = new PresenceStore()
