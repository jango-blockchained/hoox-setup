// Source: packages/shared/src/middleware/rate-limit.ts (lines 162-181)
// Listing id: rate-limiter
// Caption: KV-backed sliding-window rate limiter checkWithKey
  async function checkWithKey(fullKey: string): Promise<RateLimitResult> {
    // First check: can we even attempt a request without exceeding the limit?
    // We read current count BEFORE incrementing to avoid false negatives.
    // Under high concurrency this check is approximate (race condition window
    // between read and incr), but the alternative is always allowing one extra
    // request per concurrent batch.
    const current = await storage.get(fullKey);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= config.maxRequests) {
      const retryAfter = Math.ceil(
        config.windowSeconds -
          (Date.now() % (config.windowSeconds * 1000)) / 1000
      );
      return {
        allowed: false,
        remaining: 0,
        retryAfter,
      };
    }
