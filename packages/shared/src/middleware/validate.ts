/**
 * Validation middleware for Cloudflare Workers
 * Adapted from workers/agent-worker/src/middleware/validate.ts
 */

import type { Result } from '../types';

export async function validateJson(
  request: Request,
): Promise<Result<Record<string, unknown>>> {
  try {
    const body = await request.json();
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return { ok: false, error: 'Request body must be a JSON object' };
    }
    return { ok: true, value: body as Record<string, unknown> };
  } catch {
    return { ok: false, error: 'Invalid JSON in request body' };
  }
}

export function requireField<T>(
  body: Record<string, unknown>,
  field: string,
): Result<T> {
  if (!(field in body)) {
    return { ok: false, error: `Missing required field: ${field}` };
  }
  return { ok: true, value: body[field] as T };
}

export function optionalField<T>(
  body: Record<string, unknown>,
  field: string,
  defaultValue: T,
): T {
  if (!(field in body)) return defaultValue;
  return body[field] as T;
}
