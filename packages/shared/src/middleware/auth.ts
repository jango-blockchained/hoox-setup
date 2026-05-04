/**
 * Authentication middleware for Cloudflare Workers
 * Adapted from workers/agent-worker/src/middleware/auth.ts
 */

import type { Env } from '../types';

/**
 * Constant-time string comparison to prevent timing attacks.
 * Manually performs byte-wise XOR comparison to avoid early returns.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < aBuf.length; i++) {
    result |= aBuf[i] ^ bBuf[i];
  }
  return result === 0;
}

export async function requireAuth(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const apiKey = env.INTERNAL_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'Internal API key not configured' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const authHeader = request.headers.get('Authorization');
  const expectedHeader = `Bearer ${apiKey}`;
  if (!authHeader || !timingSafeEqual(authHeader, expectedHeader)) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return null;
}
