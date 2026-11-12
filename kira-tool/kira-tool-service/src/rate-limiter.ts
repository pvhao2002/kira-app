/**
 * Fixed-window counter per key.
 * ponytail: single instance, in-memory; bursts up to 2x at window edges. Use a shared store (Redis) when scaling out.
 */
export class RateLimiter {
  private readonly max: number;
  private readonly windowMs: number;
  private readonly windows = new Map<string, {start: number; count: number}>();

  constructor(max: number, windowMs: number) {
    this.max = max;
    this.windowMs = windowMs;
  }

  /** Returns false when the key has used up its quota for the current window. */
  tryAcquire(key: string): boolean {
    const now = performance.now();
    if (this.windows.size > 10_000) {
      for (const [k, w] of this.windows) if (now - w.start > this.windowMs) this.windows.delete(k);
    }
    const old = this.windows.get(key);
    const w = !old || now - old.start > this.windowMs ? {start: now, count: 1} : {start: old.start, count: old.count + 1};
    this.windows.set(key, w);
    return w.count <= this.max;
  }
}
