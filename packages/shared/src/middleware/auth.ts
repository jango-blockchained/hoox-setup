/**
 * Authentication middleware for Cloudflare Workers
 * Provides both Bearer token auth and internal service-to-service auth
 */

import type { Env } from "../types";
import type { MiddlewareHandler } from "../types/router";

/**
 * Constant-time string comparison to prevent timing attacks.
 * Uses crypto.timingSafeEqual for edge-native constant-time comparison.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  // Manual byte-by-byte XOR comparison for timing-safe comparison
  // This is the same approach used by crypto.timingSafeEqual but manually
  // implemented to avoid TypeScript typing issues with the global crypto type.
  let result = 0;
  for (let i = 0; i < aBuf.length; i++) {
    result |= aBuf[i] ^ bBuf[i];
  }
  return result === 0;
}

/**
 * Require Bearer token authentication via Authorization header.
 * Use for external API endpoints that need token-based auth.
 */
export async function requireAuth(
  request: Request,
  env: Env
): Promise<Response | null> {
  const apiKey = env.INTERNAL_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Internal API key not configured" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const authHeader = request.headers.get("Authorization");
  const expectedHeader = `Bearer ${apiKey}`;
  if (!authHeader || !timingSafeEqual(authHeader, expectedHeader)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

/**
 * Environment with an internal auth key binding.
 * Workers that accept internal service-to-service requests should extend this.
 * Note: Uses [key: string]: unknown for compatibility with dynamic key access.
 * This is intentionally less strict than wrangler-generated Env to allow
 * InternalAuthEnv to be satisfied by actual Env bindings at runtime.
 */
export interface InternalAuthEnv {
  [key: string]: unknown;
}

/**
 * Require internal service-to-service authentication via X-Internal-Auth-Key header.
 * Use for endpoints called by other workers via Service Bindings.
 *
 * Fails closed: if the expected key is not configured in env, the request is rejected.
 * This prevents accidental exposure of unprotected internal endpoints.
 *
 * @param request - The incoming request
 * @param env - Worker environment containing the expected key
 * @param keyName - The env binding name for the internal key (default: 'INTERNAL_KEY_BINDING')
 * @returns Response if unauthorized, null if authorized
 */
export function requireInternalAuth(
  request: Request,
  env: InternalAuthEnv,
  keyName: string = "INTERNAL_KEY_BINDING"
): Response | null {
  const expectedKey = env[keyName] as string | undefined;
  // Fail closed: if no key is configured, reject the request
  if (!expectedKey) {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Internal auth key ${keyName} not configured`,
      }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  const providedKey = request.headers.get("X-Internal-Auth-Key");
  if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
    return new Response(
      JSON.stringify({ success: false, error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }
  return null;
}

/**
 * Create a middleware function for the router that enforces internal auth.
 * Returns a Response (401) when unauthorized, or void when authorized.
 *
 * Usage: router.get("/path", handler, [createInternalAuthMiddleware()])
 *
 * @param keyName - The env binding name for the internal key (default: 'INTERNAL_KEY_BINDING')
 */
export function createInternalAuthMiddleware(
  keyName: string = "INTERNAL_KEY_BINDING"
): MiddlewareHandler<InternalAuthEnv> {
  return async (
    request: Request,
    env: InternalAuthEnv,
    _ctx: ExecutionContext
  ): Promise<Response | void> => {
    const expectedKey = env[keyName] as string | undefined;
    if (!expectedKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Internal auth key ${keyName} not configured`,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const providedKey = request.headers.get("X-Internal-Auth-Key");
    if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    return;
  };
}

/**
 * Check internal auth and return a result object (non-throwing pattern).
 * Useful when you need to check auth without immediately returning a response.
 *
 * @param request - The incoming request
 * @param env - Worker environment containing the expected key
 * @param keyName - The env binding name for the internal key (default: 'INTERNAL_KEY_BINDING')
 * @returns Object with authorized flag and optional error message
 */
export function checkInternalAuth(
  request: Request,
  env: InternalAuthEnv,
  keyName: string = "INTERNAL_KEY_BINDING"
): { authorized: boolean; error?: string } {
  const expectedKey = env[keyName] as string | undefined;
  if (!expectedKey) {
    return { authorized: false, error: `${keyName} not configured` };
  }

  const providedKey = request.headers.get("X-Internal-Auth-Key");
  if (!providedKey || !timingSafeEqual(providedKey, expectedKey)) {
    return { authorized: false, error: "Unauthorized" };
  }

  return { authorized: true };
}
