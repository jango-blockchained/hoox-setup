/**
 * WranglerResult<T> — discriminated union for all wrangler CLI operations.
 * Pattern: never throws; callers match on `ok` to handle success/error.
 */
export type WranglerResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

/** Result of a wrangler deploy operation. */
export interface DeployResult {
  /** The deployed worker URL extracted from wrangler stdout. */
  url?: string;
}

/** Result of a wrangler dev operation. */
export interface DevResult {
  /** The local dev server port. */
  port: number;
}
