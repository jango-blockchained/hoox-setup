/**
 * Rate limiting middleware for Cloudflare Workers
 * Adapted from workers/agent-worker/src/middleware/rate-limit.ts
 */

import type { Env } from '../types';

export interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  keyPrefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
}

export interface RateLimiter {
  check(request: Request): Promise<RateLimitResult>;
  enforce(request: Request): Promise<Response | null>;
}

export function createRateLimiter(
  kv: Env['CONFIG_KV'],
  config: RateLimitConfig,
): RateLimiter {
  const prefix = config.keyPrefix ?? 'rate-limit';

  function getClientIp(request: Request): string {
    // Only trust CF-Connecting-IP (Cloudflare-verified).
    // X-Forwarded-For is intentionally ignored to prevent IP spoofing attacks.
    return request.headers.get('CF-Connecting-IP') ?? 'unknown';
  }

  function getWindowKey(ip: string): string {
    const windowStart = Math.floor(Date.now() / (config.windowSeconds * 1000));
    return `${prefix}:${ip}:${windowStart}`;
  }

  async function check(request: Request): Promise<RateLimitResult> {
    const ip = getClientIp(request);
    const key = getWindowKey(ip);
    const current = await kv.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= config.maxRequests) {
      const retryAfter = config.windowSeconds - (Date.now() % (config.windowSeconds * 1000)) / 1000;
      return { allowed: false, remaining: 0, retryAfter: Math.ceil(retryAfter) };
    }

    await kv.put(key, String(count + 1), { expirationTtl: config.windowSeconds });
    return { allowed: true, remaining: config.maxRequests - count - 1 };
  }

  async function enforce(request: Request): Promise<Response | null> {
    const result = await check(request);
    if (!result.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded', retryAfter: result.retryAfter }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(result.retryAfter ?? config.windowSeconds),
          },
        },
      );
    }
    return null;
  }

  return { check, enforce };
}
