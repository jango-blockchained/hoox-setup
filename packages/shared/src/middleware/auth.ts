/**
 * Authentication middleware for Cloudflare Workers
 * Adapted from workers/agent-worker/src/middleware/auth.ts
 */

import type { Env } from '../types';

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
  if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
  }

  return null;
}
