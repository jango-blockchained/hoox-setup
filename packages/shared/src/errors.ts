/**
 * Error handling utilities for Cloudflare Workers and Dashboard
 * Centralizes error response creation across the monorepo
 */

import type { AppError, ErrorResponse } from "./types/errors";

/**
 * Safely extract an error message from any caught value.
 * Eliminates the duplicated `error instanceof Error ? error.message : String(error)`
 * pattern that appears ~40+ times across the codebase.
 *
 * @example
 * try { ... } catch (err) {
 *   console.error(toError(err));
 * }
 */
export function toError(err: unknown, fallback = "Unknown error"): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as Record<string, unknown>).message === "string"
  ) {
    return (err as Record<string, string>).message;
  }
  // null/undefined should use fallback, not be stringified to "null"/"undefined"
  if (err === null || err === undefined) return fallback;
  try {
    return JSON.stringify(err) || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Create a successful JSON response
 */
export function createJsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Create a success response with standard format
 */
export function createSuccessResponse(result?: unknown): Response {
  return createJsonResponse({ success: true, result }, 200);
}

/**
 * Create a Cloudflare Worker error response
 * Includes `success: false` in the response body for consistent client-side handling
 */
export function createErrorResponse(
  error: AppError | string,
  status?: number
): Response {
  const message = typeof error === "string" ? error : error.message;
  const statusCode =
    typeof error === "string" ? (status ?? 500) : (error.status ?? 500);

  const body: Record<string, unknown> = { success: false, error: message };
  if (typeof error !== "string" && error.code) body.code = error.code;
  if (typeof error !== "string" && error.details) body.details = error.details;

  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Predefined error factories for common error types
 */
export const Errors = {
  badRequest: (message: string) =>
    createErrorResponse({ message, status: 400, code: "BAD_REQUEST" }),
  unauthorized: (message = "Unauthorized") =>
    createErrorResponse({ message, status: 401, code: "UNAUTHORIZED" }),
  forbidden: (message = "Forbidden") =>
    createErrorResponse({ message, status: 403, code: "FORBIDDEN" }),
  notFound: (message = "Not found") =>
    createErrorResponse({ message, status: 404, code: "NOT_FOUND" }),
  methodNotAllowed: (message = "Method not allowed") =>
    createErrorResponse({ message, status: 405, code: "METHOD_NOT_ALLOWED" }),
  rateLimited: (retryAfter?: number) => {
    const res = createErrorResponse({
      message: "Rate limit exceeded",
      status: 429,
      code: "RATE_LIMITED",
    });
    if (retryAfter) res.headers.set("Retry-After", String(retryAfter));
    return res;
  },
  internal: (err?: unknown) => {
    const message = err
      ? toError(err, "Internal server error")
      : "Internal server error";
    return createErrorResponse({
      message,
      status: 500,
      code: "INTERNAL_ERROR",
    });
  },
};
