// workers/dashboard/src/lib/settings/prefixes.ts
//
// Single source of truth for KV key prefix <-> worker mappings.
// Shared between:
//   - src/app/api/settings/route.ts (server: read/write CONFIG_KV)
//   - src/lib/settings/loader.ts (client: parse dashboard.jsonc manifests)
//   - src/components/dashboard/settings-form.tsx (client: build KV key strings)
//
// Adding a new worker = add an entry here. Don't duplicate the maps in route.ts.

/**
 * Map of worker name -> default KV key prefix.
 * Used when the client sends a key without a section prefix (e.g. just
 * "kill_switch" for hoox). With a prefix (e.g. "webhook:tradingview_ip_check_enabled")
 * the SECTION_PREFIX_MAP takes precedence.
 */
export const WORKER_PREFIX_MAP = {
  hoox: "global:",
  "trade-worker": "trade:",
  "agent-worker": "agent:",
  "telegram-worker": "bot:",
  "d1-worker": "database:",
  "email-worker": "email:",
  "web3-wallet-worker": "wallet:",
} as const;

/**
 * Map of section id (from dashboard.jsonc) -> KV key prefix.
 * Multiple sections can map to the same prefix (e.g. "security" reuses
 * "webhook:" because security settings live under the webhook section).
 */
export const SECTION_PREFIX_MAP = {
  global: "global:",
  webhook: "webhook:",
  routing: "routing:",
  security: "webhook:",
  trade: "trade:",
  agent: "agent:",
  bot: "bot:",
  email: "email:",
  database: "database:",
  retention: "retention:",
  cron: "cron:",
  behavior: "behavior:",
  exchanges: "trade:",
  fees: "trade:",
} as const;

/**
 * Reverse map: KV prefix -> worker name.
 * Used by GET to group settings by worker after listing by prefix.
 */
export const PREFIX_TO_WORKER: Record<string, string> = Object.fromEntries(
  Object.entries(WORKER_PREFIX_MAP).map(([worker, prefix]) => [prefix, worker])
);

/**
 * Prefixes used by the GET endpoint to list CONFIG_KV entries.
 * Includes "ai:" which is read but no worker has it as a default prefix
 * (the AI provider config is set via the agent-worker's "agent" section
 * and stored under "agent:").
 */
export const READ_PREFIXES = [
  "global:",
  "webhook:",
  "trade:",
  "agent:",
  "bot:",
  "email:",
  "database:",
  "retention:",
  "routing:",
  "behavior:",
  "cron:",
  "ai:",
] as const;

export type WorkerName = keyof typeof WORKER_PREFIX_MAP;

/**
 * Build a CONFIG_KV key from a worker + key. If the key already has a
 * `section:` prefix, the section is mapped to a known prefix; otherwise
 * the worker's default prefix is used.
 */
export function buildKVKey(worker: string, key: string): string {
  if (key.includes(":")) {
    const [section, ...rest] = key.split(":");
    const sectionPrefix =
      (SECTION_PREFIX_MAP as Record<string, string>)[section ?? ""] ?? "";
    return `${sectionPrefix}${rest.join(":")}`;
  }
  const workerPrefix =
    (WORKER_PREFIX_MAP as Record<string, string>)[worker] ?? "";
  return `${workerPrefix}${key}`;
}

/**
 * Identify the worker that owns a given KV key (longest-prefix match).
 * Returns null if no known prefix matches.
 */
export function workerForKVKey(kvKey: string): string | null {
  for (const [prefix, worker] of Object.entries(PREFIX_TO_WORKER)) {
    if (kvKey.startsWith(prefix)) return worker;
  }
  return null;
}

/**
 * Strip the worker's default prefix from a KV key to get the raw field name.
 * Returns the original key if no worker prefix matches.
 */
export function stripWorkerPrefix(kvKey: string, worker: string): string {
  const prefix = (WORKER_PREFIX_MAP as Record<string, string>)[worker] ?? "";
  if (prefix && kvKey.startsWith(prefix)) {
    return kvKey.substring(prefix.length);
  }
  return kvKey;
}
