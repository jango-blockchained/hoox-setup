/**
 * SecretsService types — secret management for Cloudflare Workers.
 */

// ---------------------------------------------------------------------------
// Result
// ---------------------------------------------------------------------------

import type { Result } from "@jango-blockchained/hoox-shared";

// Re-export the shared Result<T> for convenience
export type { Result };

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface SecretStatus {
  /** Name of the secret (e.g. "TELEGRAM_BOT_TOKEN"). */
  name: string;
  /** Whether the secret has a real (non-placeholder) value set. */
  set: boolean;
  /** Where the value was found ("workers/<name>/.dev.vars" or undefined). */
  source?: string;
}

export interface SecretCheckResult {
  /** Worker name as it appears in wrangler.jsonc. */
  worker: string;
  /** Per-secret status entries. */
  secrets: SecretStatus[];
  /** True when *every* required secret is present with a real value. */
  allSet: boolean;
  /** Secret names that are either missing or still placeholder. */
  missing: string[];
}

// ---------------------------------------------------------------------------
// Internal config shape (subset of wrangler.jsonc used by SecretsService)
// ---------------------------------------------------------------------------

export interface WorkerSecretConfig {
  enabled: boolean;
  path: string;
  secrets?: string[];
}

export interface WorkersJsonc {
  workers: Record<string, WorkerSecretConfig>;
}
