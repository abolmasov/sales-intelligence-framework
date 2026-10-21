/**
 * Concurrency primitives for the agent orchestration framework.
 *
 * - Semaphore:            Limits concurrent operations (e.g. max 2 bulk jobs at once)
 * - TokenBucketRateLimiter: Limits API call rate (e.g. OpenAI RPM/TPM)
 */

// ---------------------------------------------------------------------------
// Semaphore — counting semaphore for concurrency control
// ---------------------------------------------------------------------------

export class Semaphore {
  private permits: number;
  private readonly maxPermits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
    this.maxPermits = permits;
  }

  /** Acquire a permit, waiting if none are available. */
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise<void>((resolve) => {
      this.waiting.push(resolve);
    });
  }

  /** Release a permit, waking up one waiting caller if any. */
  release(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift()!;
      next();
    } else {
      this.permits = Math.min(this.permits + 1, this.maxPermits);
    }
  }

  /** Number of permits currently available. */
  get available(): number {
    return this.permits;
  }

  /** Number of callers waiting for a permit. */
  get queueLength(): number {
    return this.waiting.length;
  }
}

// ---------------------------------------------------------------------------
// Token Bucket Rate Limiter — for API rate limiting
// ---------------------------------------------------------------------------

export class TokenBucketRateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private readonly refillRate: number; // tokens per second
  private lastRefill: number;

  /**
   * @param maxTokens  Maximum burst capacity
   * @param refillRate Tokens added per second
   */
  constructor(maxTokens: number, refillRate: number) {
    this.tokens = maxTokens;
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire `cost` tokens, waiting until enough are available.
   * @param cost Number of tokens to consume (default 1)
   */
  async acquire(cost: number = 1): Promise<void> {
    this.refill();
    while (this.tokens < cost) {
      const waitMs = ((cost - this.tokens) / this.refillRate) * 1000;
      await new Promise((resolve) => setTimeout(resolve, Math.max(50, waitMs)));
      this.refill();
    }
    this.tokens -= cost;
  }

  /** Current available tokens. */
  get available(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsedSeconds * this.refillRate);
    this.lastRefill = now;
  }
}
