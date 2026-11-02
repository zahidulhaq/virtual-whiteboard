import { afterEach, describe, expect, it, vi } from 'vitest'
import { shapeSchema } from '../src/lib/shapes.js'
import { colorFor } from '../src/realtime/presence.js'
import { TokenBucket } from '../src/realtime/rateLimiter.js'
import { generateRoomCode } from '../src/services/boards.js'
import { sampleShape } from './helpers.js'

describe('shapeSchema', () => {
  it('accepts a valid shape', () => {
    expect(shapeSchema.safeParse(sampleShape()).success).toBe(true)
  })

  it('rejects odd point counts, bad colours and empty text', () => {
    expect(shapeSchema.safeParse({ ...sampleShape(), points: [1, 2, 3] }).success).toBe(false)
    expect(shapeSchema.safeParse({ ...sampleShape(), color: 'red' }).success).toBe(false)
    expect(shapeSchema.safeParse({ ...sampleShape(), kind: 'text', points: [0, 0] }).success).toBe(false)
    expect(shapeSchema.safeParse({ ...sampleShape(), kind: 'text', points: [0, 0], text: 'hi' }).success).toBe(true)
  })
})

describe('TokenBucket', () => {
  afterEach(() => vi.useRealTimers())

  it('allows bursts up to capacity then refills over time', () => {
    vi.useFakeTimers()
    const bucket = new TokenBucket(3, 1)
    expect([bucket.take(), bucket.take(), bucket.take(), bucket.take()]).toEqual([true, true, true, false])
    vi.advanceTimersByTime(1_000)
    expect(bucket.take()).toBe(true)
    expect(bucket.take()).toBe(false)
  })
})

describe('helpers', () => {
  it('generates readable room codes', () => {
    for (let i = 0; i < 100; i++) expect(generateRoomCode()).toMatch(/^[A-HJ-NP-Z2-9]{6}$/)
  })

  it('assigns a stable colour per user', () => {
    expect(colorFor('user-1')).toBe(colorFor('user-1'))
    expect(colorFor('user-1')).toMatch(/^#[0-9a-f]{6}$/)
  })
})
