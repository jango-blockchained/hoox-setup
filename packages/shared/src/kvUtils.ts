/**
 * Utility functions for KV operations
 * Shared across workers that need KV timestamp logging
 */
import type { KVNamespace } from "@cloudflare/workers-types";
import { toError } from "./errors.js";

/**
 * Interface for environments with a KVNamespace binding
 */
export interface EnvWithKV {
  REPORT_KV: KVNamespace;
  [key: string]: unknown;
}

/**
 * Logs a timestamp to KV
 * @param env - Environment with KV binding
 * @param prefix - Optional prefix for the key
 * @returns Promise that resolves when the operation completes
 */
export async function logKvTimestamp(
  env: EnvWithKV,
  prefix: string = "timestamp"
): Promise<void> {
  const timestamp = new Date().toISOString();
  const key = `${prefix}_${timestamp}`;
  try {
    await env.REPORT_KV.put(key, timestamp);
    console.log(`Logged timestamp ${timestamp} to KV with key ${key}`);
  } catch (error) {
    console.error(
      `Failed to log timestamp to KV: ${toError(error, "Unknown error")}`
    );
  }
}

/**
 * Helper function to convert Headers to a plain object
 * @param headers - The Headers object to convert
 * @returns Plain object representation of headers
 */
export function headersToObject(
  headers: Headers | null | undefined
): Record<string, string> {
  const result: Record<string, string> = {};
  if (!headers) return result;

  // Safely iterate through headers
  try {
    headers.forEach((value, key) => {
      result[key] = value;
    });
  } catch (error) {
    console.error(
      `Error converting headers to object: ${toError(error, "Unknown error")}`
    );
  }

  return result;
}

/**
 * KV middleware function for logging timestamps
 */
export const kvTimestampMiddleware = () => {
  return async (
    c: { env: unknown },
    next: () => Promise<void>
  ): Promise<void> => {
    await logKvTimestamp(c.env as unknown as EnvWithKV);
    await next();
  };
};
