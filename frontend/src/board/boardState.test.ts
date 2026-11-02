import { describe, expect, it } from 'vitest'
import type { BoardEvent, Shape } from '../lib/types'
import { buildShapes, mergeEvents } from './boardState'

const shape = (id: string): Shape => ({ id, kind: 'pen', points: [0, 0, 1, 1], color: '#000000', strokeWidth: 2 })

const event = (seq: number, input: Pick<BoardEvent, 'type' | 'payload'>): BoardEvent =>
  ({ seq, userId: 'u1', createdAt: new Date(0).toISOString(), ...input }) as BoardEvent

describe('buildShapes', () => {
  it('applies adds, deletes and clears in order', () => {
    const events = [
      event(1, { type: 'SHAPE_ADD', payload: { shape: shape('a') } }),
      event(2, { type: 'SHAPE_ADD', payload: { shape: shape('b') } }),
      event(3, { type: 'SHAPE_DELETE', payload: { id: 'a' } }),
    ]
    expect([...buildShapes(events).keys()]).toEqual(['b'])

    const cleared = [...events, event(4, { type: 'CLEAR', payload: {} }), event(5, { type: 'SHAPE_ADD', payload: { shape: shape('c') } })]
    expect([...buildShapes(cleared).keys()]).toEqual(['c'])
  })

  it('ignores deletes of unknown shapes', () => {
    expect(buildShapes([event(1, { type: 'SHAPE_DELETE', payload: { id: 'missing' } })]).size).toBe(0)
  })
})

describe('mergeEvents', () => {
  it('sorts by seq and drops duplicates', () => {
    const a = event(1, { type: 'CLEAR', payload: {} })
    const b = event(2, { type: 'CLEAR', payload: {} })
    const c = event(3, { type: 'CLEAR', payload: {} })
    expect(mergeEvents([a, c], [b, c]).map((e) => e.seq)).toEqual([1, 2, 3])
  })

  it('returns the same array when nothing is incoming', () => {
    const list = [event(1, { type: 'CLEAR', payload: {} })]
    expect(mergeEvents(list, [])).toBe(list)
  })
})
