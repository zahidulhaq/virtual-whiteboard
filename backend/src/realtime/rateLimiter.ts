/**
 * Token bucket used to cap how fast a single socket can emit events.
 * `capacity` allows short bursts; `refillPerSecond` is the sustained rate.
 */
export class TokenBucket {
  private tokens: number
  private lastRefill = Date.now()

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {
    this.tokens = capacity
  }

  take(): boolean {
    const now = Date.now()
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.lastRefill) / 1000) * this.refillPerSecond)
    this.lastRefill = now
    if (this.tokens < 1) return false
    this.tokens -= 1
    return true
  }
}
