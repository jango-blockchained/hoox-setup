/**
 * Deploy command types — options and result interfaces for the deploy
 * command group (all, workers, worker, dashboard).
 */

/**
 * Options for a single worker deployment.
 */
export interface DeployOptions {
  /** Cloudflare environment (e.g. "production", "staging"). */
  env?: string;
}

/**
 * Result of deploying a single worker.
 */
export interface DeployResult {
  /** Worker name as defined in workers.jsonc. */
  worker: string;
  /** Deployed URL extracted from wrangler output, if available. */
  url?: string;
  /** Whether the deployment succeeded. */
  success: boolean;
  /** Error message when success is false. */
  error?: string;
}
