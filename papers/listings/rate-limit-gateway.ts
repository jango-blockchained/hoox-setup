// Source: workers/hoox/src/index.ts (lines 28-44)
// Listing id: rate-limit-gateway
// Caption: Per-session webhook rate limit (10 trades/minute via CONFIG_KV)
// --- Rate limiting limits (passed to KV-backed rate limiter) ---
const MAX_TRADES_PER_MINUTE = 10;
const RATE_LIMIT_WINDOW = 60; // 60 seconds

async function checkRateLimit(
  sessionId: string,
  env: { CONFIG_KV?: KVNamespace }
): Promise<boolean> {
  const kv = env.CONFIG_KV;
  const rateLimiter = createRateLimiter(kv, {
    maxRequests: MAX_TRADES_PER_MINUTE,
    windowSeconds: RATE_LIMIT_WINDOW,
    keyPrefix: "hoox-webhook",
  });
  const result = await rateLimiter.checkKey(sessionId);
  return result.allowed;
}
