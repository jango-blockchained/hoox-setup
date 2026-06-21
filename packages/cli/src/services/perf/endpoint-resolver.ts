/**
 * Resolves the deployed `hoox` gateway URL.
 *
 * Priority:
 *   1. HOOX_GATEWAY_URL env var (with trailing-slash trim).
 *   2. CLOUDFLARE_ACCOUNT_ID env var + worker name → https://{name}.{account}.workers.dev
 *
 * Throws if neither is available.
 */

export interface ResolveOptions {
  workerName?: string; // default "hoox"
}

export function resolveGatewayUrl(options: ResolveOptions = {}): string {
  const envUrl = process.env.HOOX_GATEWAY_URL;
  if (envUrl && envUrl.length > 0) {
    return envUrl.replace(/\/+$/, "");
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const workerName = options.workerName ?? "hoox";
  if (accountId && accountId.length > 0) {
    return `https://${workerName}.${accountId}.workers.dev`;
  }

  throw new Error(
    "Cannot resolve hoox gateway URL. Set HOOX_GATEWAY_URL or CLOUDFLARE_ACCOUNT_ID environment variable."
  );
}
