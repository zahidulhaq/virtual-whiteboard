import { afterEach, describe, expect, it, vi } from 'vitest'
import { throttle } from './throttle'

describe('throttle', () => {
  afterEach(() => vi.useRealTimers())

  it('calls immediately, then delivers only the latest call per window', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const throttled = throttle(fn, 100)

    throttled(1)
    throttled(2)
    throttled(3)
    expect(fn.mock.calls).toEqual([[1]])

    vi.advanceTimersByTime(100)
    expect(fn.mock.calls).toEqual([[1], [3]])
  })

  it('can be cancelled', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const throttled = throttle(fn, 100)
    throttled(1)
    throttled(2)
    throttled.cancel()
    vi.advanceTimersByTime(200)
    expect(fn.mock.calls).toEqual([[1]])
  })
})
