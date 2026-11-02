import type { BoardEvent, BoardEventInput, Shape } from '../lib/types'

/** Ordered map so later shapes render on top of earlier ones. */
export type ShapeMap = Map<string, Shape>

export function applyEvent(shapes: ShapeMap, event: BoardEventInput): ShapeMap {
  switch (event.type) {
    case 'SHAPE_ADD':
      shapes.set(event.payload.shape.id, event.payload.shape)
      return shapes
    case 'SHAPE_DELETE':
      shapes.delete(event.payload.id)
      return shapes
    case 'CLEAR':
      shapes.clear()
      return shapes
  }
}

export function buildShapes(events: Iterable<BoardEventInput>): ShapeMap {
  const shapes: ShapeMap = new Map()
  for (const event of events) applyEvent(shapes, event)
  return shapes
}

/** Merges events into a seq-sorted list without duplicates. */
export function mergeEvents(current: BoardEvent[], incoming: BoardEvent[]): BoardEvent[] {
  if (incoming.length === 0) return current
  const bySeq = new Map(current.map((e) => [e.seq, e]))
  for (const event of incoming) bySeq.set(event.seq, event)
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq)
}

export function newShapeId(): string {
  return crypto.randomUUID()
}
