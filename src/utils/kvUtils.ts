import type { KVNamespace } from "@cloudflare/workers-types";
import type { Context, Next } from "hono"; // Import Hono types for middleware

// Interface representing an environment with the required KV namespace
export interface EnvWithKV {
  CONFIG_KV: KVNamespace;
  // Allow other properties
  [key: string]: any;
}

/**
 * Logs the last request timestamp from KV and updates it.
 * Handles potential KV errors gracefully.
 * @param env - The worker environment containing CONFIG_KV.
 * @param kvKey - The KV key to use for the timestamp (defaults to "last_request_timestamp").
 */
export async function logKvTimestamp(env: EnvWithKV, kvKey: string = "last_request_timestamp"): Promise<void> {
  try {
    const lastRequest = await env.CONFIG_KV.get(kvKey);
    console.log(`KV (${kvKey}): Last request timestamp:`, lastRequest || "Not found");
    await env.CONFIG_KV.put(kvKey, new Date().toISOString());
    console.log(`KV (${kvKey}): Updated timestamp.`);
  } catch (kvError) {
    console.error(`KV Error reading/writing key "${kvKey}":`, kvError);
    // Decide if KV error should block the request or just be logged
    // Currently, it just logs the error and continues.
  }
}

/**
 * Hono middleware to log the last request timestamp from KV and update it.
 * @param kvKey - The KV key to use (defaults to "last_request_timestamp").
 */
export function kvTimestampMiddleware(kvKey: string = "last_request_timestamp") {
  return async (c: Context<{ Bindings: EnvWithKV }>, next: Next) => {
    // Run the KV logic before proceeding
    await logKvTimestamp(c.env, kvKey);
    // Continue to the next middleware or handler
    await next();
  };
} 