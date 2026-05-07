/**
 * SecretsService types — secret management for Cloudflare Workers.
 *
 * The `Result<T>` discriminated-union mirrors the pattern used in
 * @jango-blockchained/hoox-shared (see packages/shared/src/types.ts:92) but is defined
 * locally to avoid adding a public export to the shared package.
 */

// ---------------------------------------------------------------------------
// Result / Wrangler
// ---------------------------------------------------------------------------

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export interface WranglerResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

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
  /** Worker name as it appears in workers.jsonc. */
  worker: string;
  /** Per-secret status entries. */
  secrets: SecretStatus[];
  /** True when *every* required secret is present with a real value. */
  allSet: boolean;
  /** Secret names that are either missing or still placeholder. */
  missing: string[];
}

// ---------------------------------------------------------------------------
// Internal config shape (subset of workers.jsonc used by SecretsService)
// ---------------------------------------------------------------------------

export interface WorkerSecretConfig {
  enabled: boolean;
  path: string;
  secrets?: string[];
}

export interface WorkersJsonc {
  workers: Record<string, WorkerSecretConfig>;
}
