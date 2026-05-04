/**
 * Error handling utilities for Cloudflare Workers and Dashboard
 * Centralizes error response creation across the monorepo
 */

import type { AppError, ErrorResponse } from './types/errors';

/**
 * Create a successful JSON response
 */
export function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Create a Cloudflare Worker error response
 */
export function createErrorResponse(
  error: AppError | string,
  status?: number
): Response {
  const message = typeof error === 'string' ? error : error.message;
  const statusCode = typeof error === 'string' ? (status ?? 500) : (error.status ?? 500);
  
  const body: ErrorResponse = { error: message };
  if (typeof error !== 'string' && error.code) body.code = error.code;
  if (typeof error !== 'string' && error.details) body.details = error.details;

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Predefined error factories for common error types
 */
export const Errors = {
  badRequest: (message: string) => createErrorResponse({ message, status: 400, code: 'BAD_REQUEST' }),
  unauthorized: (message = 'Unauthorized') => createErrorResponse({ message, status: 401, code: 'UNAUTHORIZED' }),
  forbidden: (message = 'Forbidden') => createErrorResponse({ message, status: 403, code: 'FORBIDDEN' }),
  notFound: (message = 'Not found') => createErrorResponse({ message, status: 404, code: 'NOT_FOUND' }),
  rateLimited: (retryAfter?: number) => {
    const res = createErrorResponse({ message: 'Rate limit exceeded', status: 429, code: 'RATE_LIMITED' });
    if (retryAfter) res.headers.set('Retry-After', String(retryAfter));
    return res;
  },
  internal: (message = 'Internal server error') => createErrorResponse({ message, status: 500, code: 'INTERNAL_ERROR' }),
};
