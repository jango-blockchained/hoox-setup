/**
 * CliBridge — Spawns the hoox CLI binary and returns structured results.
 *
 * Provides convenience methods for all CLI operations used by TUI views,
 * with configurable timeout, abort support, and stderr streaming.
 *
 * Every `CliResult` now carries `command` (the exact command string) and
 * `errorType` (a `CliErrorType` classification) so the status bar can
 * surface actionable diagnostics instead of a generic OFFLINE message.
 *
 * Global error sink: callers (e.g. the app root) can register an
 * `onError` listener once via `cliBridge.onError(fn)` and receive a
 * structured `CliErrorDetails` payload for **every** failed command —
 * not just the ones the caller explicitly invoked. This is the wiring
 * point that lets the status bar surface the real diagnostic context
 * for any CLI failure, regardless of which view triggered it.
 */
import * as path from "path";
import type { CliResult, CliErrorType, CliErrorDetails } from "../types";

/** Cap stderr/stdout capture per command to keep the store lightweight. */
const MAX_OUTPUT_CHARS = 4096;

export interface ExecOptions {
  json?: boolean;
  yes?: boolean;
  timeout?: number;
  onProgress?: (chunk: string) => void;
  tag?: string;
}

/**
 * Semantic action name for the kill-switch bridge. The UI speaks engage/release
 * (user-facing verbs), the CLI speaks on/off. We accept the semantic name
 * here and translate internally.
 */
export type KillSwitchAction = "show" | "engage" | "release";

/**
 * Normalized status of the global trade kill switch.
 *
 * Returned by {@link CliBridgeImpl.monitorKillSwitch} so views don't need to
 * parse the CLI's colored output themselves.
 */
export interface KillSwitchStatus {
  /** True when trading is halted (KV value === "true") */
  engaged: boolean;
  /** Raw KV value as returned by the CLI ("true" | "false" | null when unset) */
  rawValue: string | null;
  /** ISO-8601 timestamp captured client-side when the status was read */
  timestamp: string;
  /** The action that produced this status (helpful for UI feedback) */
  action: KillSwitchAction;
}

/**
 * Backlog pressure for a single Cloudflare Queue.
 *
 * Returned by {@link CliBridgeImpl.monitorQueueDepth} — the shape is fully
 * normalized on the bridge side so views can render directly without
 * needing to parse wrangler's JSON or the CLI's stdout.
 *
 * The `depth` field is a *heuristic estimate* derived from
 * `producers_total_count` (each producer is assumed to enqueue ~100 msgs
 * on average) because Cloudflare Queues does not expose real-time backlog
 * counts via `wrangler queues list`. The view's color coding
 * (green/yellow/red) operates on this estimate.
 *
 * Threshold conventions (used by the view's color coding):
 *   - depth < 100             → "healthy"
 *   - 100 <= depth <= 500     → "backlogged"
 *   - depth > 500             → "critical"
 *   - delivery_paused = true  → "paused" (overrides depth thresholds)
 *   - no data                 → "unknown"
 */
export type QueueDepthStatus =
  | "healthy"
  | "backlogged"
  | "critical"
  | "paused"
  | "unknown";

/** Per-queue depth info. See {@link QueueDepthStatus} for status semantics. */
export interface QueueDepth {
  queueName: string;
  depth: number;
  max: number;
  status: QueueDepthStatus;
  /** Cloudflare producer count (informational, view can render) */
  producers: number;
  /** Cloudflare consumer count (informational, view can render) */
  consumers: number;
  /** True when delivery is paused on this queue */
  paused: boolean;
  /** ISO-8601 timestamp when the depth was sampled */
  timestamp: string;
}

/** Default max depth for visualization (clamps the fill-bar). */
const DEFAULT_QUEUE_MAX = 1000;
/** Heuristic scale: assume each producer is responsible for ~100 msgs. */
const DEPTH_PER_PRODUCER = 100;
/** Status thresholds (see {@link QueueDepthStatus} for semantics). */
const HEALTHY_THRESHOLD = 100;
const CRITICAL_THRESHOLD = 500;

/**
 * Normalized result of a read-only D1 SQL query executed through
 * {@link CliBridgeImpl.dbQuery}.
 *
 * Mirrors the wrangler `d1 execute --json` envelope shape but collapses it
 * to what the TUI view actually needs:
 *
 *   wrangler:
 *     [ { results: [{...}, {...}], success: true,
 *         meta: { duration: 0.123, rows_read: 42, ... } } ]
 *
 *   → DbQueryResult:
 *     { columns: [...], rows: [...], rowCount, executionTimeMs, meta }
 */
export interface DbQueryResult {
  /** Column names in display order (derived from the first row). */
  columns: string[];
  /** Row data, one record per result. */
  rows: Record<string, unknown>[];
  /** Convenience: `rows.length`. */
  rowCount: number;
  /** Wall-clock SQL execution time in milliseconds (from wrangler's `meta.duration`),
   *  or `null` if wrangler did not report it. */
  executionTimeMs: number | null;
  /** Raw wrangler `meta` block for callers that want additional fields
   *  (rows_read, changed_db, etc.). Null when the CLI did not return a meta block. */
  meta: Record<string, unknown> | null;
}

/**
 * Outcome of a client-side SQL safety check.
 *
 * Returned by {@link validateReadOnlySql} so the view can surface a
 * specific, actionable error message without ever round-tripping the
 * command to the local `hoox` binary.
 */
export type SqlValidationResult =
  | { readonly: true }
  | { readonly: false; reason: string };

/**
 * SQL keywords that the TUI's `db-query` view is forbidden from sending.
 *
 * Defends against accidental or malicious DML/DDL via the TUI's read-only
 * SQL input. Detection is case-insensitive and word-boundary aware.
 */
const FORBIDDEN_SQL_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "REPLACE",
  "DROP",
  "CREATE",
  "ALTER",
  "TRUNCATE",
  "PRAGMA",
  "ATTACH",
  "DETACH",
  "VACUUM",
  "REINDEX",
] as const;

/**
 * SQL keywords permitted as the first non-whitespace, non-comment token.
 *
 * `SELECT` is the canonical read-only entry point. `WITH` is allowed because
 * CTEs (Common Table Expressions) are read-only when followed by a SELECT.
 * `EXPLAIN` is allowed because it is read-only and is useful for query
 * diagnostics.
 */
const ALLOWED_ENTRY_KEYWORDS = ["SELECT", "WITH", "EXPLAIN"] as const;

/** Strip SQL line comments (`-- ...\n`) and block comments (`/* ... *\/`). */
function stripSqlComments(input: string): string {
  // Block comments: /* ... */ (non-greedy, multi-line)
  const noBlock = input.replace(/\/\*[\s\S]*?\*\//g, " ");
  // Line comments: -- to end-of-line
  const noLine = noBlock.replace(/--[^\n]*/g, " ");
  return noLine;
}

/** Strip single-quoted and double-quoted string literals (rough heuristic). */
function stripSqlStrings(input: string): string {
  // Single-quoted with doubled '' escapes
  const noSingle = input.replace(/'(?:''|[^'])*'/g, "''");
  // Double-quoted identifiers
  const noDouble = noSingle.replace(/"[^"]*"/g, '""');
  return noDouble;
}

/**
 * Validate that a SQL string is a read-only D1 query safe to send through
 * the TUI's `db-query` view.
 *
 * Rules enforced:
 *   1. Must be non-empty after trimming.
 *   2. First non-whitespace, non-comment, non-string token must be one of
 *      {@link ALLOWED_ENTRY_KEYWORDS} (case-insensitive).
 *   3. The statement must not contain any of {@link FORBIDDEN_SQL_KEYWORDS}
 *      as a word (case-insensitive, word-boundary aware).
 *   4. At most one `;` is allowed, and only as the trailing terminator
 *      (i.e. multi-statement payloads like `SELECT 1; DROP TABLE x` are
 *      rejected).
 *
 * The function never throws. Returns a structured result the view can
 * render directly.
 */
export function validateReadOnlySql(sql: string): SqlValidationResult {
  if (typeof sql !== "string" || sql.trim().length === 0) {
    return { readonly: false, reason: "SQL is empty" };
  }

  const stripped = stripSqlStrings(stripSqlComments(sql)).trim();
  if (stripped.length === 0) {
    return { readonly: false, reason: "SQL is empty (only comments?)" };
  }

  // First significant token: take the first whitespace-delimited word.
  const firstTokenMatch = stripped.match(/^[\s(]*([A-Za-z_]+)/);
  const firstToken = firstTokenMatch?.[1]?.toUpperCase() ?? "";
  if (
    !ALLOWED_ENTRY_KEYWORDS.includes(
      firstToken as (typeof ALLOWED_ENTRY_KEYWORDS)[number]
    )
  ) {
    return {
      readonly: false,
      reason: `Only SELECT, WITH, or EXPLAIN queries are allowed (got "${firstToken || "(nothing)"}")`,
    };
  }

  // Reject any forbidden keyword as a whole word (case-insensitive).
  for (const keyword of FORBIDDEN_SQL_KEYWORDS) {
    const pattern = new RegExp(`\\b${keyword}\\b`, "i");
    if (pattern.test(stripped)) {
      return {
        readonly: false,
        reason: `Forbidden keyword: ${keyword}. Read-only queries only.`,
      };
    }
  }

  // Reject multiple statements. Allow at most one trailing `;`.
  const semicolons = (stripped.match(/;/g) ?? []).length;
  if (semicolons > 1) {
    return {
      readonly: false,
      reason: "Multiple statements are not allowed. Use a single query.",
    };
  }
  if (semicolons === 1) {
    const lastSemi = stripped.lastIndexOf(";");
    if (lastSemi !== stripped.length - 1) {
      // Allow 1 trailing whitespace after the semicolon, but nothing else.
      const trailing = stripped.slice(lastSemi + 1).trim();
      if (trailing.length > 0) {
        return {
          readonly: false,
          reason: "Semicolons are only allowed at the end of the query.",
        };
      }
    }
  }

  return { readonly: true };
}

/**
 * Convert the structured JSON envelope emitted by `wrangler d1 execute
 * --json` into a normalized {@link DbQueryResult}. Unknown records are
 * skipped; the function never throws on malformed input.
 *
 * Expected envelope shape (one element, the success envelope):
 *   [ { "results": [ {...}, {...} ], "success": true,
 *       "meta": { "duration": 0.123, "rows_read": 42, ... } } ]
 */
function parseDbQueryResult(stdout: string): DbQueryResult {
  const cleaned = stdout.trim();
  if (!cleaned) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: null,
      meta: null,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: null,
      meta: null,
    };
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: null,
      meta: null,
    };
  }

  // The first envelope is the one we care about.
  const envelope = parsed[0];
  if (!envelope || typeof envelope !== "object") {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: null,
      meta: null,
    };
  }

  const env = envelope as {
    results?: unknown;
    success?: unknown;
    meta?: unknown;
  };

  // If wrangler reported success=false, still surface the row data — the
  // error message is already in the bridge's stderr field.
  const rowsRaw = env.results;
  if (!Array.isArray(rowsRaw)) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: null,
      meta: null,
    };
  }

  const rows: Record<string, unknown>[] = [];
  for (const r of rowsRaw) {
    if (r && typeof r === "object" && !Array.isArray(r)) {
      rows.push(r as Record<string, unknown>);
    }
  }

  // Derive column order from the first row's keys.
  const columns =
    rows.length > 0 && rows[0] !== null ? Object.keys(rows[0]) : [];

  // wrangler's `meta.duration` is reported in seconds (float). Convert to ms.
  let executionTimeMs: number | null = null;
  let meta: Record<string, unknown> | null = null;
  if (env.meta && typeof env.meta === "object" && !Array.isArray(env.meta)) {
    meta = env.meta as Record<string, unknown>;
    const duration = (meta as { duration?: unknown }).duration;
    if (typeof duration === "number" && Number.isFinite(duration)) {
      // Always non-negative; cap at 24h to avoid display glitches.
      const ms = Math.max(0, duration * 1000);
      executionTimeMs = ms < 86_400_000 ? ms : null;
    }
  }

  return {
    columns,
    rows,
    rowCount: rows.length,
    executionTimeMs,
    meta,
  };
}

/** Compute the {@link QueueDepthStatus} for a given depth + paused flag. */
function deriveQueueDepthStatus(
  depth: number,
  paused: boolean
): QueueDepthStatus {
  if (paused) return "paused";
  if (depth < HEALTHY_THRESHOLD) return "healthy";
  if (depth <= CRITICAL_THRESHOLD) return "backlogged";
  return "critical";
}

/**
 * Convert the structured JSON envelope emitted by the CLI's
 * `hoox monitor queue-depth --json` command into a normalized
 * {@link QueueDepth} array. Unknown queue names are skipped;
 * the bridge never throws on malformed input.
 *
 * Expected envelope shape:
 *   { "queues": [ { "queue_name": "...", "producers_total_count": 2, ... } ] }
 */
function parseQueueDepths(stdout: string): QueueDepth[] {
  const timestamp = new Date().toISOString();
  const cleaned = stdout.trim();
  if (!cleaned) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  if (
    parsed === null ||
    typeof parsed !== "object" ||
    !("queues" in parsed) ||
    !Array.isArray((parsed as { queues: unknown }).queues)
  ) {
    return [];
  }

  const records = (parsed as { queues: WranglerQueueRecord[] }).queues;
  const result: QueueDepth[] = [];

  for (const record of records) {
    if (!record || typeof record !== "object") continue;
    const name = record.queue_name ?? record.queue_id;
    if (typeof name !== "string" || name.length === 0) continue;

    const producers =
      typeof record.producers_total_count === "number"
        ? record.producers_total_count
        : 0;
    const consumers =
      typeof record.consumers_total_count === "number"
        ? record.consumers_total_count
        : 0;
    const paused = record.settings?.delivery_paused === true;

    // Heuristic depth — see QueueDepthStatus doc-comment for rationale.
    const depth = paused
      ? DEFAULT_QUEUE_MAX
      : Math.max(0, producers * DEPTH_PER_PRODUCER);

    result.push({
      queueName: name,
      depth,
      max: DEFAULT_QUEUE_MAX,
      status: deriveQueueDepthStatus(depth, paused),
      producers,
      consumers,
      paused,
      timestamp,
    });
  }

  return result;
}

/**
 * Parse the JSON output emitted by `hoox config secrets list --json`.
 *
 * The CLI emits one of two shapes:
 *   - Single worker: { worker: string, secrets: string[] }
 *   - All workers: Record<string, string[]>
 *
 * This parser accepts both and normalizes to a flat SecretMetadata array.
 * Values are intentionally omitted — the viewer is strictly read-only.
 * The parser never throws on malformed input.
 */
function parseSecretsList(stdout: string): SecretMetadata[] {
  const cleaned = stdout.trim();
  if (!cleaned) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  // Single-worker envelope: { worker: string, secrets: string[] }
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    "worker" in parsed &&
    "secrets" in parsed
  ) {
    const envelope = parsed as { worker: string; secrets: unknown };
    if (Array.isArray(envelope.secrets)) {
      const result: SecretMetadata[] = [];
      for (const item of envelope.secrets) {
        if (typeof item === "string") {
          result.push({
            name: item,
            type: inferSecretType(item),
            source: "config",
          });
        }
      }
      return result;
    }
    return [];
  }

  // All-workers envelope: Record<string, string[]>
  if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
    const entries = Object.entries(parsed as Record<string, unknown>);
    const result: SecretMetadata[] = [];
    for (const [, value] of entries) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string") {
            result.push({
              name: item,
              type: inferSecretType(item),
              source: "config",
            });
          }
        }
      }
    }
    return result;
  }

  return [];
}

/**
 * Infer the secret type from its name using naming conventions.
 * Cloudflare secrets store does not expose per-secret type metadata,
 * so we derive it from the key name suffix.
 */
function inferSecretType(name: string): SecretMetadata["type"] {
  const lower = name.toLowerCase();
  if (lower.includes("key") || lower.includes("api")) return "api_key";
  if (lower.includes("token")) return "token";
  if (lower.includes("password") || lower.includes("passwd")) return "password";
  if (lower.includes("secret")) return "secret";
  return "unknown";
}

/**
 * A single Cloudflare Workers secret metadata (read-only, no values exposed).
 *
 * Returned by {@link CliBridgeImpl.configSecretsList}. Values are intentionally
 * omitted — the TUI viewer is strictly read-only and the CLI equivalent
 * (`hoox config secrets list`) only surfaces names/types anyway.
 */
export interface SecretMetadata {
  /** Secret name / key, e.g. "BINANCE_KEY_BINDING" or "OPENAI_API_KEY". */
  name: string;
  /**
   * Inferred type based on naming conventions. Cloudflare secrets store
   * does not expose per-secret type metadata, so we derive it from the
   * key name suffix.
   */
  type: "api_key" | "secret" | "token" | "password" | "unknown";
  /**
   * Source of the secret declaration: either "Cloudflare" (via wrangler secret)
   * or "config" (declared in wrangler.jsonc but not yet synced).
   */
  source: "Cloudflare" | "config";
}

/**
 * A read-only snapshot of all secrets across workers. Returned by
 * {@link CliBridgeImpl.configSecretsList}.
 */
export interface SecretsSnapshot {
  secrets: SecretMetadata[];
  /**
   * ISO-8601 timestamp captured client-side when the snapshot was read.
   * Surfaces a "Last sampled" footer in the view.
   */
  timestamp: string;
}

/**
 * A single Cloudflare KV key as exposed by `hoox config kv list --json`.
 *
 * The view treats `valueSize` and `lastModified` as best-effort metadata:
 * the canonical CLI output only includes `name` and the human-readable
 * flag. Future CLI versions may surface richer metadata; the view renders
 * a dash in those columns when the data is missing so the table stays
 * aligned.
 *
 * Security note: `isSecret` is *advisory* — it is derived by cross-
 * referencing the key name against the known KV manifest. Users should
 * still treat any KV value as potentially sensitive.
 */
export interface KvKey {
  /** Full key name, e.g. `"trade:kill_switch"` or `"agent:openai_key"`. */
  name: string;
  /** Byte size of the stored value. `null` if unknown. */
  valueSize: number | null;
  /**
   * ISO-8601 timestamp of the last write. `null` if the CLI did not
   * surface it (current `hoox config kv list` does not include it).
   */
  lastModified: string | null;
  /**
   * True if the key is known to be secret per the KV manifest. Manifest
   * keys with `secret: true` (API keys, watermarks, etc.) are flagged
   * here so the view can render a warning before showing the value.
   */
  isSecret: boolean;
  /**
   * Manifest-declared type for this key, when known. One of
   * `"boolean" | "number" | "string" | null`. Useful for rendering a
   * type tag in the table.
   */
  manifestType: "boolean" | "number" | "string" | null;
}

/**
 * A read-only snapshot of all KV keys plus the manifest cross-reference
 * used to flag secret keys. Returned by {@link CliBridgeImpl.configKvList}.
 */
export interface KvKeySnapshot {
  keys: KvKey[];
  /**
   * ISO-8601 timestamp captured client-side when the snapshot was read.
   * Surfaces a "Last sampled" footer in the view.
   */
  timestamp: string;
  /**
   * The KV namespace ID that was used to fetch the keys. `null` when the
   * CLI auto-detection failed (e.g. wrangler not installed).
   */
  namespaceId: string | null;
}

/**
 * Subset of the KV manifest row shape that we care about for the viewer.
 * Mirrors the row from `hoox config kv manifest --json`; the bridge
 * always treats every field as optional so it tolerates future schema
 * changes or wrangler not being installed.
 */
interface KvManifestRecord {
  key?: string;
  type?: "boolean" | "number" | "string";
  secret?: boolean;
}

/**
 * Subset of the wrangler key-listing record shape we care about.
 * We treat every field as optional so we degrade gracefully when fields
 * are missing or wrangler changes its schema.
 */
interface WranglerKeyRecord {
  name?: string;
  metadata?: { value_size?: number; last_modified?: string } | null;
}

/**
 * Parse the JSON output emitted by `hoox config kv list --json` and merge
 * it with manifest metadata to flag secret keys.
 *
 * The CLI emits one of two shapes:
 *   - Array form: `[ { "name": "..." }, ... ]` (current)
 *   - Envelope form: `{ "keys": [ { "name": "..." }, ... ] }` (future-proof)
 *
 * This parser accepts both. Unknown rows are skipped; the parser never
 * throws on malformed input — it returns an empty `keys` array instead.
 */
function parseKvList(
  stdout: string,
  manifest: Map<
    string,
    { type: "boolean" | "number" | "string"; secret: boolean }
  >
): KvKey[] {
  const cleaned = stdout.trim();
  if (!cleaned) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return [];
  }

  let records: unknown;
  if (Array.isArray(parsed)) {
    records = parsed;
  } else if (
    parsed !== null &&
    typeof parsed === "object" &&
    "keys" in parsed &&
    Array.isArray((parsed as { keys: unknown }).keys)
  ) {
    records = (parsed as { keys: unknown }).keys;
  } else {
    return [];
  }

  const list = records as WranglerKeyRecord[];
  const result: KvKey[] = [];
  for (const record of list) {
    if (!record || typeof record !== "object") continue;
    const name = record.name;
    if (typeof name !== "string" || name.length === 0) continue;

    const meta = manifest.get(name);
    const valueSize =
      record.metadata && typeof record.metadata.value_size === "number"
        ? record.metadata.value_size
        : null;
    const lastModified =
      record.metadata && typeof record.metadata.last_modified === "string"
        ? record.metadata.last_modified
        : null;

    result.push({
      name,
      valueSize,
      lastModified,
      isSecret: meta?.secret === true,
      manifestType: meta?.type ?? null,
    });
  }
  return result;
}

/**
 * Parse the manifest emitted by `hoox config kv manifest --json` and
 * return a `Map` keyed by key name. Returns an empty map on any failure
 * — the view still functions, it just cannot flag secret keys.
 */
function parseKvManifest(
  stdout: string
): Map<string, { type: "boolean" | "number" | "string"; secret: boolean }> {
  const map = new Map<
    string,
    { type: "boolean" | "number" | "string"; secret: boolean }
  >();
  const cleaned = stdout.trim();
  if (!cleaned) return map;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return map;
  }

  // Manifest shape: { namespace: "CONFIG_KV", keys: [{ key, type, default, ... }] }
  const keys =
    parsed !== null &&
    typeof parsed === "object" &&
    "keys" in parsed &&
    Array.isArray((parsed as { keys: unknown }).keys)
      ? ((parsed as { keys: unknown }).keys as KvManifestRecord[])
      : [];

  for (const record of keys) {
    if (!record || typeof record !== "object") continue;
    const name = record.key;
    if (typeof name !== "string" || name.length === 0) continue;
    const type =
      record.type === "boolean" ||
      record.type === "number" ||
      record.type === "string"
        ? record.type
        : "string";
    map.set(name, { type, secret: record.secret === true });
  }
  return map;
}

/** ANSI escape sequence pattern for stripping terminal color codes */
const ANSI_PATTERN = /\x1b\[[0-9;]*[A-Za-z]/g;

/** Remove ANSI color escape codes from a string. */
function stripAnsi(input: string): string {
  return input.replace(ANSI_PATTERN, "");
}

/**
 * Subset of the wrangler `queues list --json` record shape we care about.
 * We treat every field as optional so we degrade gracefully when fields
 * are missing or wrangler changes its schema.
 */
interface WranglerQueueRecord {
  queue_name?: string;
  queue_id?: string;
  producers_total_count?: number;
  consumers_total_count?: number;
  settings?: {
    delivery_paused?: boolean;
    message_retention_period?: number;
  };
}

/**
 * Convert `hoox monitor kill-switch <action>` output into a structured
 * {@link KillSwitchStatus}. The CLI's `show` subcommand emits a colored
 * human-readable string even in --json mode (its implementation only
 * switches the format for set actions), so we detect the engaged/released
 * state from the message text.
 */
function parseKillSwitchStatus(
  action: KillSwitchAction,
  stdout: string
): KillSwitchStatus {
  const timestamp = new Date().toISOString();
  const cleaned = stripAnsi(stdout).trim();
  const lowered = cleaned.toLowerCase();

  if (action === "engage") {
    return { engaged: true, rawValue: "true", timestamp, action };
  }
  if (action === "release") {
    return { engaged: false, rawValue: "false", timestamp, action };
  }

  // 'show' — derive state from the human-readable status line
  if (lowered.includes("kill switch is on") || lowered.includes("halted")) {
    return { engaged: true, rawValue: "true", timestamp, action };
  }
  if (
    lowered.includes("kill switch is off") ||
    (lowered.includes("active") && !lowered.includes("halted"))
  ) {
    return { engaged: false, rawValue: "false", timestamp, action };
  }

  // Fallback — look for an explicit "value: <v>" or "(not set)" marker
  const valueMatch = cleaned.match(/value:\s*(\S+)/i);
  if (valueMatch) {
    const raw = valueMatch[1] ?? null;
    return {
      engaged: raw === "true",
      rawValue: raw,
      timestamp,
      action,
    };
  }

  // Unknown output — treat as released (fail-open for display, but flag raw)
  return { engaged: false, rawValue: null, timestamp, action };
}

class CliBridgeImpl {
  private binaryPath: string | null = null;
  /** Maps tag → set of AbortControllers for concurrent commands with same tag */
  private activeCommands = new Map<string, Set<AbortController>>();
  /**
   * Global error sinks invoked on every CLI bridge failure. Listeners
   * receive a fully-formed `CliErrorDetails` payload so callers don't
   * need to translate `CliResult.errorType` themselves. The status bar
   * registers one sink at app startup to surface the real diagnostic
   * context (command, exit code, stderr) regardless of which view
   * triggered the command.
   */
  private errorSinks = new Set<(details: CliErrorDetails) => void>();

  async resolveBinary(): Promise<string> {
    if (this.binaryPath) return this.binaryPath;

    const fromPath = Bun.which("hoox");
    if (fromPath) {
      this.binaryPath = fromPath;
      return fromPath;
    }

    const root = await this.findMonorepoRoot();

    const nodeBin = path.join(root, "node_modules", ".bin", "hoox");
    if (await Bun.file(nodeBin).exists()) {
      this.binaryPath = nodeBin;
      return nodeBin;
    }

    const cliBin = path.join(root, "packages", "cli", "bin", "hoox.js");
    if (await Bun.file(cliBin).exists()) {
      this.binaryPath = cliBin;
      return cliBin;
    }

    throw new Error("hoox binary not found — is the CLI installed?");
  }

  /** Track a new command under a tag. Returns a cleanup function. */
  private trackCommand(tag: string, aborter: AbortController): () => void {
    const controllers = this.activeCommands.get(tag) ?? new Set();
    controllers.add(aborter);
    this.activeCommands.set(tag, controllers);
    return () => {
      const set = this.activeCommands.get(tag);
      if (set) {
        set.delete(aborter);
        if (set.size === 0) this.activeCommands.delete(tag);
      }
    };
  }

  invalidateCache(): void {
    this.binaryPath = null;
  }

  /**
   * Register a global error sink. The sink is invoked **synchronously**
   * after every `exec()` call that produced a non-null `errorType`, with
   * a fully-formed `CliErrorDetails` payload (command, exit code, stderr,
   * stdout, classification, duration, timestamp).
   *
   * Returns an unsubscribe function. Safe to call from React `useEffect`
   * — typical pattern is to register on mount, unsubscribe on unmount.
   *
   * Sinks must not throw; exceptions are caught and logged so a buggy
   * listener can never break the bridge.
   */
  onError(sink: (details: CliErrorDetails) => void): () => void {
    this.errorSinks.add(sink);
    return () => {
      this.errorSinks.delete(sink);
    };
  }

  /**
   * Build a `CliErrorDetails` snapshot from a finished `CliResult` and
   * fan it out to every registered sink. No-op on success.
   *
   * `timestamp` is captured at the moment the command finished (not at
   * registration time) so multiple commands get distinct timestamps.
   */
  private notifyError(result: CliResult<unknown>): void {
    if (result.errorType === null) return;
    const details: CliErrorDetails = {
      command: result.command,
      exitCode: result.exitCode,
      stderr: result.stderr,
      stdout: result.stdout,
      errorType: result.errorType,
      timestamp: Date.now(),
      duration: result.duration,
    };
    for (const sink of this.errorSinks) {
      try {
        sink(details);
      } catch (err) {
        // Defensive: a buggy sink must never break the bridge.

        console.error("[cli-bridge] error sink threw:", err);
      }
    }
  }

  private async findMonorepoRoot(): Promise<string> {
    let dir = process.cwd();
    while (true) {
      try {
        const pkgPath = path.join(dir, "package.json");
        const pkg = JSON.parse(await Bun.file(pkgPath).text()) as {
          workspaces?: string[];
        };
        if (pkg.workspaces) return dir;
      } catch {
        /* not found or invalid JSON */
      }
      const parent = path.dirname(dir);
      if (parent === dir) throw new Error("Monorepo root not found");
      dir = parent;
    }
  }

  /**
   * Truncate long captured output to a safe cap, preserving the tail
   * (where most CLI errors appear) and adding a marker.
   */
  private truncateOutput(text: string): string {
    if (text.length <= MAX_OUTPUT_CHARS) return text;
    const tail = text.slice(text.length - MAX_OUTPUT_CHARS + 64);
    return `…[${text.length - tail.length} chars truncated]…\n${tail}`;
  }

  /**
   * Public entry point. Wraps {@link execCore} with error-sink
   * notification so every caller — convenience methods and direct
   * invocations alike — propagates failures to registered listeners
   * without each caller having to do the bookkeeping.
   */
  async exec<T>(args: string[], options?: ExecOptions): Promise<CliResult<T>> {
    const result = await this.execCore<T>(args, options);
    this.notifyError(result);
    return result;
  }

  /**
   * Internal exec implementation. Always returns a fully-populated
   * `CliResult` — never throws. All failure modes (spawn, abort,
   * timeout, non-zero exit, JSON parse) are classified into
   * `errorType` so the wrapper can fan out to listeners.
   */
  private async execCore<T>(
    args: string[],
    options?: ExecOptions
  ): Promise<CliResult<T>> {
    const start = performance.now();
    const tag = options?.tag ?? args[0] ?? "unknown";
    const aborter = new AbortController();
    const cleanup = this.trackCommand(tag, aborter);

    const cmdArgs = [...args];
    if (options?.json) cmdArgs.push("--json");
    if (options?.yes) cmdArgs.push("--yes");

    // Stable command label for the "binary not found" path where the
    // resolved binary path is unknown.
    const baseCommand = `hoox ${args.join(" ")}`;

    try {
      const binary = await this.resolveBinary();
      const command = `${binary} ${cmdArgs.join(" ")}`;
      let proc: ReturnType<typeof Bun.spawn>;
      try {
        proc = Bun.spawn([binary, ...cmdArgs], {
          stdout: "pipe",
          stderr: "pipe",
          signal: aborter.signal,
        });
      } catch (spawnErr) {
        // Bun.spawn itself failed (EACCES, ENOENT, etc.) — classify it.
        cleanup();
        const stderr = (spawnErr as Error).message;
        return {
          success: false,
          exitCode: -1,
          stdout: "",
          stderr,
          data: null,
          duration: performance.now() - start,
          command,
          errorType: "spawn-error",
        };
      }

      const timeoutMs = options?.timeout ?? 30_000;
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        aborter.abort();
      }, timeoutMs);

      let stderrResult = "";
      const readStderr = async () => {
        const reader = (proc.stderr as ReadableStream<Uint8Array>).getReader();
        const decoder = new TextDecoder();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            stderrResult += chunk;
            options?.onProgress?.(chunk);
          }
        } catch (streamErr) {
          // Stream closing due to abort is expected
          if (!aborter.signal.aborted) throw streamErr;
        }
      };

      const [stdout] = await Promise.all([
        new Response(proc.stdout as ReadableStream<Uint8Array>).text(),
        readStderr(),
      ]);

      const exitCode = await proc.exited;
      clearTimeout(timer);
      cleanup();

      // Explicitly close process streams to prevent resource leaks.
      // Bun.spawn with "pipe" mode creates stream handles that must be
      // released even when the process exits successfully.
      try {
        (proc.stderr as ReadableStream<Uint8Array>)?.cancel();
      } catch {
        /* stream may already be closed */
      }
      try {
        (proc.stdout as ReadableStream<Uint8Array>)?.cancel();
      } catch {
        /* stream may already be closed */
      }

      let data: T | null = null;
      if (options?.json && exitCode === 0 && stdout.trim()) {
        try {
          data = JSON.parse(stdout) as T;
        } catch {
          /* non-JSON output even with --json flag */
        }
      }

      // Classify the failure (success leaves errorType=null).
      const errorType: CliErrorType | null =
        exitCode === 0
          ? null
          : timedOut
            ? "timeout"
            : aborter.signal.aborted
              ? "aborted"
              : "non-zero-exit";

      return {
        success: exitCode === 0,
        exitCode,
        stdout: this.truncateOutput(stdout),
        stderr: this.truncateOutput(stderrResult),
        data,
        duration: performance.now() - start,
        command,
        errorType,
      };
    } catch (err) {
      cleanup();
      const isAbort = err instanceof Error && err.name === "AbortError";
      // Distinguish "binary not found" from generic spawn-time errors so
      // the status bar can suggest `bun install` rather than a runtime fix.
      const errorType: CliErrorType = isAbort
        ? "aborted"
        : (err as Error).message.includes("not found")
          ? "binary-not-found"
          : "spawn-error";
      return {
        success: false,
        exitCode: -1,
        stdout: "",
        stderr: this.truncateOutput(
          isAbort ? "Command timed out or was aborted" : (err as Error).message
        ),
        data: null,
        duration: performance.now() - start,
        command: baseCommand,
        errorType,
      };
    }
  }

  abort(tag: string): void {
    const controllers = this.activeCommands.get(tag);
    if (controllers) {
      for (const aborter of controllers) aborter.abort();
      this.activeCommands.delete(tag);
    }
  }

  dispose(): void {
    for (const [, controllers] of this.activeCommands) {
      for (const aborter of controllers) aborter.abort();
    }
    this.activeCommands.clear();
  }

  deployAll(onProgress?: (chunk: string) => void): Promise<CliResult<unknown>> {
    return this.exec(["deploy", "all"], {
      json: true,
      yes: true,
      timeout: 120_000,
      onProgress,
      tag: "deploy:all",
    });
  }

  deployWorker(
    name: string,
    onProgress?: (chunk: string) => void
  ): Promise<CliResult<unknown>> {
    return this.exec(["deploy", "worker", name], {
      json: true,
      yes: true,
      timeout: 60_000,
      onProgress,
      tag: `deploy:${name}`,
    });
  }

  checkHealth(): Promise<CliResult<unknown>> {
    return this.exec(["check", "health"], {
      json: true,
      timeout: 15_000,
      tag: "check:health",
    });
  }

  /**
   * Run health check with auto-fix probe via `hoox check health --fix`.
   *
   * Returns health check results with fix recommendations. Unlike `checkFix`,
   * this does not apply any repairs — it only checks connectivity and suggests
   * running `hoox check fix` if issues were found.
   *
   * @returns A CliResult with `data` containing a `HealthCheckResult[]` when
   *          successful (same shape as `checkHealth`).
   */
  checkHealthFix(): Promise<CliResult<unknown>> {
    return this.exec(["check", "health", "--fix"], {
      json: true,
      timeout: 15_000,
      tag: "check:health:fix",
    });
  }

  /**
   * Run auto-repair via `hoox check fix` to apply non-destructive fixes.
   *
   * Performs common repairs:
   *   1. Creates missing .dev.vars placeholder files
   *   2. Adds missing nodejs_compat compatibility flags
   *   3. Adds missing name fields to wrangler.jsonc
   *
   * @returns A CliResult with `data` containing a `FixReport` with the
   *          fix action results (applied, failed, or skipped).
   */
  checkFix(): Promise<CliResult<unknown>> {
    return this.exec(["check", "fix"], {
      json: true,
      yes: true,
      timeout: 60_000,
      tag: "check:fix",
    });
  }

  workerLogs(name: string): Promise<CliResult<unknown>> {
    return this.exec(["logs", "worker", name], {
      json: true,
      timeout: 15_000,
      tag: `logs:${name}`,
    });
  }

  configShow(): Promise<CliResult<unknown>> {
    return this.exec(["config", "show"], {
      json: true,
      timeout: 10_000,
      tag: "config:show",
    });
  }

  configValidate(): Promise<CliResult<unknown>> {
    return this.exec(["config", "env", "validate"], {
      json: true,
      timeout: 10_000,
      tag: "config:validate",
    });
  }

  monitorStatus(): Promise<CliResult<unknown>> {
    return this.exec(["monitor", "status"], {
      json: true,
      timeout: 15_000,
      tag: "monitor:status",
    });
  }

  rebuild(onProgress?: (chunk: string) => void): Promise<CliResult<unknown>> {
    return this.exec(["repair", "rebuild"], {
      json: true,
      yes: true,
      timeout: 120_000,
      onProgress,
      tag: "repair:rebuild",
    });
  }

  repairWorker(
    name: string,
    onProgress?: (chunk: string) => void
  ): Promise<CliResult<unknown>> {
    return this.exec(["repair", "worker", name], {
      json: true,
      yes: true,
      timeout: 60_000,
      onProgress,
      tag: `repair:${name}`,
    });
  }

  checkSetup(): Promise<CliResult<unknown>> {
    return this.exec(["check", "setup"], {
      json: true,
      timeout: 20_000,
      tag: "check:setup",
    });
  }

  /**
   * Control the global trade kill switch via `hoox monitor kill-switch <action>`.
   *
   * Accepts semantic action names ("show" | "engage" | "release") — these are
   * translated internally to the CLI's "on"/"off" verbs.
   *
   * @param action - "show" reads current state, "engage" halts trading,
   *                 "release" resumes trading.
   * @returns A CliResult with `data` containing a structured {engaged, rawValue, timestamp}
   *          payload. The CLI's `show` subcommand emits a colored human-readable string
   *          even in --json mode, so we parse stdout to derive `engaged`.
   */
  monitorKillSwitch(
    action: KillSwitchAction
  ): Promise<CliResult<KillSwitchStatus>> {
    // Map semantic action → CLI verb
    const cliAction =
      action === "engage" ? "on" : action === "release" ? "off" : "show";

    return this.exec(["monitor", "kill-switch", cliAction], {
      json: true,
      yes: true,
      timeout: 15_000,
      tag: `monitor:kill-switch:${action}`,
    }).then((result) => {
      if (!result.success) {
        return { ...result, data: null };
      }
      return {
        ...result,
        data: parseKillSwitchStatus(action, result.stdout),
      };
    });
  }

  /**
   * Read Cloudflare Queue backlog pressure via `hoox monitor queue-depth`.
   *
   * The CLI runs `wrangler queues list --json` and re-emits a normalized
   * `{ queues: [...] }` envelope. We parse that envelope into a fully-typed
   * {@link QueueDepth} array so the view can render directly without
   * knowing the wrangler/CLI plumbing.
   *
   * Note: `wrangler queues list` does not expose real-time message counts.
   * `depth` is a heuristic estimate derived from the producer count (each
   * producer is assumed to enqueue ~100 messages on average). See the
   * {@link QueueDepth} doc for the full status model.
   *
   * @returns A CliResult with `data` containing the array of queues. The
   *          data is `null` on failure (e.g., wrangler not installed or
   *          not authenticated). On success with zero queues, `data` is
   *          an empty array — not `null`.
   */
  monitorQueueDepth(): Promise<CliResult<QueueDepth[]>> {
    return this.exec(["monitor", "queue-depth"], {
      json: true,
      timeout: 20_000,
      tag: "monitor:queue-depth",
    }).then((result) => {
      if (!result.success) {
        return { ...result, data: null };
      }
      return {
        ...result,
        data: parseQueueDepths(result.stdout),
      };
    });
  }

  /**
   * Execute a read-only D1 SQL query via `hoox db query <sql>`.
   *
   * The CLI runs `wrangler d1 execute <db> --command <sql> --json` and
   * passes the envelope through. We:
   *   1. Run {@link validateReadOnlySql} on the SQL *first* — if the
   *      caller passed a non-SELECT, the bridge returns a structured
   *      "non-zero-exit" CliResult with the validation reason in stderr
   *      and never spawns the CLI. This is the TUI's read-only guarantee.
   *   2. On CLI success, parse the wrangler envelope into a normalized
   *      {@link DbQueryResult} (columns, rows, execution time).
   *
   * The validation step is intentionally duplicated on the client (the
   * CLI also has its own; see `hoox db query --help`). Defence in depth.
   *
   * @param sql - The SQL string. Must be a read-only statement.
   * @returns A CliResult with `data` containing a {@link DbQueryResult} on
   *          success, or `null` on any failure (validation, spawn, or
   *          wrangler error). The bridge never throws.
   */
  dbQuery(sql: string): Promise<CliResult<DbQueryResult>> {
    const trimmed = (sql ?? "").trim();
    const validation = validateReadOnlySql(trimmed);
    if (!validation.readonly) {
      // Refuse to spawn the CLI; return a synthetic non-zero-exit result
      // with the validation reason in stderr. The view's existing error
      // rendering surfaces this without any special-casing.
      const reason = (validation as { reason: string }).reason;
      return Promise.resolve({
        success: false,
        exitCode: 1,
        stdout: "",
        stderr: `Read-only validation failed: ${reason}`,
        data: null,
        duration: 0,
        command: `hoox db query ${JSON.stringify(trimmed)}`,
        errorType: "non-zero-exit",
      });
    }

    return this.exec(["db", "query", trimmed], {
      json: true,
      timeout: 30_000,
      tag: "db:query",
    }).then((result) => {
      if (!result.success) {
        return { ...result, data: null };
      }
      return {
        ...result,
        data: parseDbQueryResult(result.stdout),
      };
    });
  }

  /**
   * Read the Cloudflare CONFIG_KV namespace via `hoox config kv list` and
   * merge the result with the manifest (`hoox config kv manifest`) so
   * secret keys can be flagged in the UI.
   *
   * The bridge fires both commands in parallel — they are independent
   * reads and the view can render the key list as soon as it arrives
   * (manifest data enriches the rendered rows but is not required).
   *
   * Security note: this method returns *names* and metadata only. To
   * fetch an individual value the caller should use
   * {@link CliBridgeImpl.configKvGet}. The KV viewer is intentionally
   * read-only — write operations are not exposed in the TUI; use the
   * `hoox config kv set` / `hoox config kv delete` commands instead.
   *
   * @returns A CliResult with `data` containing a {@link KvKeySnapshot}.
   *          `data` is `null` on failure (CLI binary not found, wrangler
   *          not installed, etc.). On success with zero keys, `data.keys`
   *          is an empty array.
   */
  configKvList(): Promise<CliResult<KvKeySnapshot>> {
    return Promise.all([
      this.exec(["config", "kv", "list"], {
        json: true,
        timeout: 20_000,
        tag: "config:kv:list",
      }),
      this.exec(["config", "kv", "manifest"], {
        json: true,
        timeout: 20_000,
        tag: "config:kv:manifest",
      }),
    ]).then(([listResult, manifestResult]) => {
      // If the primary list command failed, surface its error verbatim —
      // the manifest failure is secondary and the view can still render
      // an empty manifest cross-reference.
      if (!listResult.success) {
        return {
          ...listResult,
          data: null,
        };
      }
      const manifest = manifestResult.success
        ? parseKvManifest(manifestResult.stdout)
        : new Map<
            string,
            { type: "boolean" | "number" | "string"; secret: boolean }
          >();
      const keys = parseKvList(listResult.stdout, manifest);
      // Extract namespace ID from the manifest envelope when available,
      // otherwise leave it null. The view only needs it for display.
      const nsId = extractNamespaceId(manifestResult.stdout);
      const snapshot: KvKeySnapshot = {
        keys,
        timestamp: new Date().toISOString(),
        namespaceId: nsId,
      };
      return {
        ...listResult,
        data: snapshot,
      };
    });
  }

  /**
   * Fetch the value of a single KV key via `hoox config kv get <key>`.
   *
   * This is a separate method (not bundled into `configKvList`) so the
   * viewer can lazy-load individual values only when the user expands a
   * row. It is the read-only counterpart to the write operations
   * intentionally *not* exposed in the TUI.
   *
   * @param key - The KV key name to look up.
   * @returns A CliResult with `data` containing the string value
   *          (`null` when the key is missing, empty string, or when the
   *          command failed).
   */
  configKvGet(key: string): Promise<CliResult<string | null>> {
    return this.exec(["config", "kv", "get", key], {
      json: true,
      timeout: 15_000,
      tag: `config:kv:get:${key}`,
    }).then((result) => {
      if (!result.success) {
        // Missing key is not a hard error — the CLI exits non-zero with
        // a "not found" message and the viewer should display an empty
        // value rather than an error pill.
        const combined = `${result.stdout}\n${result.stderr}`.toLowerCase();
        if (combined.includes("not found")) {
          return { ...result, data: null, success: true };
        }
        return { ...result, data: null };
      }
      const cleaned = result.stdout.replace(/\n$/, "").trim();
      return {
        ...result,
        data: cleaned.length > 0 ? cleaned : null,
      };
    });
  }

  /**
   * Read the list of secrets declared in wrangler.jsonc via
   * `hoox config secrets list --json`.
   *
   * Security: this method returns *names* and *inferred types* only.
   * No secret values are ever fetched or displayed — the viewer is
   * strictly read-only and values are not available via the CLI in
   * any case (`hoox config secrets list` only returns names).
   *
   * @returns A CliResult with `data` containing a {@link SecretsSnapshot}.
   *          `data` is `null` on failure (CLI binary not found, wrangler
   *          not installed, etc.). On success with zero secrets, `data.secrets`
   *          is an empty array.
   */
  configSecretsList(): Promise<CliResult<SecretsSnapshot>> {
    return this.exec(["config", "secrets", "list"], {
      json: true,
      timeout: 20_000,
      tag: "config:secrets:list",
    }).then((result) => {
      if (!result.success) {
        return { ...result, data: null };
      }
      const secrets = parseSecretsList(result.stdout);
      const snapshot: SecretsSnapshot = {
        secrets,
        timestamp: new Date().toISOString(),
      };
      return { ...result, data: snapshot };
    });
  }

  /**
   * Check the health of all AI model providers via `hoox agent health --json`.
   *
   * The CLI command queries configured AI providers (Workers AI, OpenAI,
   * Anthropic, Google, Azure) and returns their operational status, latency,
   * and usage metrics. This is used by the TUI dashboard to display a
   * real-time health overview of all AI integrations.
   *
   * @returns A CliResult with `data` containing an {@link AgentHealthResult}
   *          on success, or `null` on failure. On success with zero providers,
   *          `data.providers` is an empty array — not `null`.
   */
  agentHealthCheck(): Promise<CliResult<AgentHealthResult>> {
    return this.exec(["agent", "health"], {
      json: true,
      timeout: 30_000,
      tag: "agent:health",
    }).then((result) => {
      if (!result.success) {
        return { ...result, data: null };
      }
      return {
        ...result,
        data: parseAgentHealth(result.stdout),
      };
    });
  }
}

/**
 * Health status for a single AI model provider.
 */
export interface ModelHealth {
  /** Provider name, e.g. "Workers AI", "OpenAI", "Anthropic", "Google", "Azure" */
  name: string;
  /** Provider-specific model identifier, e.g. "@cf/meta/llama-3.1-8b-instruct" */
  model: string;
  /** Operational state */
  status: "online" | "degraded" | "offline";
  /** Latency in milliseconds (null when unknown or offline) */
  latencyMs: number | null;
  /** Daily request count (null when unavailable) */
  dailyRequests: number | null;
  /** Error message when status is not "online" */
  error?: string;
}

/**
 * Result of an AI model health check covering all configured providers.
 */
export interface AgentHealthResult {
  providers: ModelHealth[];
  /** ISO-8601 timestamp when the check was performed */
  timestamp: string;
}

/**
 * Parse the JSON output from `hoox agent health --json` into a structured
 * {@link AgentHealthResult}. Unknown provider shapes are skipped; the
 * function never throws on malformed input — it returns an empty providers
 * array instead.
 *
 * Expected envelope shape:
 *   { "providers": [ { "name": "...", "model": "...", "status": "online",
 *                      "latencyMs": 45, "dailyRequests": 1234 } ] }
 */
function parseAgentHealth(stdout: string): AgentHealthResult {
  const timestamp = new Date().toISOString();
  const cleaned = stdout.trim();
  if (!cleaned) {
    return { providers: [], timestamp };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return { providers: [], timestamp };
  }

  if (
    parsed === null ||
    typeof parsed !== "object" ||
    !("providers" in parsed) ||
    !Array.isArray((parsed as { providers: unknown }).providers)
  ) {
    return { providers: [], timestamp };
  }

  const records = (parsed as { providers: unknown }).providers;
  const result: ModelHealth[] = [];

  for (const record of records as unknown[]) {
    if (!record || typeof record !== "object") continue;

    const r = record as Record<string, unknown>;
    const name =
      typeof r.name === "string" && r.name.length > 0 ? r.name : null;
    if (!name) continue;

    const model = typeof r.model === "string" ? r.model : "unknown";
    const statusRaw = r.status;
    const status: ModelHealth["status"] =
      statusRaw === "online" ||
      statusRaw === "degraded" ||
      statusRaw === "offline"
        ? statusRaw
        : "offline";
    const latencyMs =
      typeof r.latencyMs === "number" && r.latencyMs >= 0 ? r.latencyMs : null;
    const dailyRequests =
      typeof r.dailyRequests === "number" && r.dailyRequests >= 0
        ? r.dailyRequests
        : null;
    const error = typeof r.error === "string" ? r.error : undefined;

    result.push({ name, model, status, latencyMs, dailyRequests, error });
  }

  return { providers: result, timestamp };
}

/**
 * Extract the namespace ID from a `hoox config kv manifest --json` envelope
 * if it carries one. Currently the CLI's manifest envelope does not
 * include the ID, so this returns `null` for the time being. The helper
 * exists so future manifest changes can light up the namespace column
 * without touching the viewer.
 */
function extractNamespaceId(_manifestStdout: string): string | null {
  // Reserved for future CLI versions — manifest envelope does not yet
  // surface the namespace ID. Kept as a separate function to keep the
  // test surface stable.
  return null;
}

export const cliBridge = new CliBridgeImpl();

// ─── AI Chat SSE Streaming ───────────────────────────────────────────────────

/** Local AI chat message shape. */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/** Available AI providers/models for the chat interface. */
export interface AiModelOption {
  id: string;
  label: string;
  provider: string;
}

/** Default AI model options offered in the chat UI. */
export const AI_MODEL_OPTIONS: AiModelOption[] = [
  { id: "workers-ai", label: "Workers AI (Llama 3.1)", provider: "cloudflare" },
  {
    id: "openai:gpt-4o-mini",
    label: "OpenAI (GPT-4o-mini)",
    provider: "openai",
  },
  {
    id: "anthropic:claude-3-5-haiku",
    label: "Anthropic (Claude 3.5 Haiku)",
    provider: "anthropic",
  },
];

/** Reconnection backoff for SSE streaming. */
const SSE_RECONNECT_BASE_MS = 1_000;
const SSE_RECONNECT_MAX_MS = 16_000;
const SSE_MAX_RECONNECT_ATTEMPTS = 5;

/**
 * SSE streaming subscription for AI chat responses.
 *
 * Connects to the hoox-setup API's /api/agent/chat endpoint and invokes
 * the onToken callback for each streamed token fragment. Supports
 * reconnection with exponential backoff on connection loss.
 *
 * Returns an AbortController whose `.signal.aborted` flag can be set
 * to terminate the stream; callers should check this flag to avoid
 * processing tokens after abort.
 */
export interface AgentChatStreamResult {
  /** AbortController for cancelling the stream. */
  abort: AbortController;
  /** Promise that resolves when the stream finishes or fails. */
  finished: Promise<void>;
}

/**
 * Start an SSE stream to the AI chat endpoint.
 *
 * @param params          Chat parameters (messages, model, temperature, etc.)
 * @param apiBase         Base URL for the API (default: http://localhost:8787)
 * @param apiToken        Bearer token for auth (default: HOOX_API_TOKEN env var)
 * @param onToken         Called with each streamed token string fragment
 * @param onStatus        Optional callback for connection status updates
 * @returns               An AgentChatStreamResult with abort + finished
 */
export function agentChatStream(
  params: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
  apiBase: string = "http://localhost:8787",
  apiToken: string = process.env.HOOX_API_TOKEN ?? "",
  onToken?: (token: string) => void,
  onStatus?: (status: "connected" | "reconnecting" | "disconnected") => void
): AgentChatStreamResult {
  const abortController = new AbortController();
  let completed = false;

  const finished = (async () => {
    let attempt = 0;

    while (
      !abortController.signal.aborted &&
      attempt < SSE_MAX_RECONNECT_ATTEMPTS
    ) {
      try {
        const url = `${apiBase.replace(/\/$/, "")}/api/agent/chat`;
        const body = JSON.stringify({
          messages: params.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model:
            params.model && params.model !== "workers-ai"
              ? params.model
              : undefined,
          temperature: params.temperature ?? 0.7,
          maxTokens: params.maxTokens ?? 500,
          stream: true,
        });

        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
          },
          body,
          signal: abortController.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Chat stream failed: HTTP ${response.status}`);
        }

        attempt = 0;
        onStatus?.("connected");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!abortController.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              const data = trimmed.slice(6);
              if (data === "[DONE]") {
                completed = true;
                break;
              }
              try {
                const parsed = JSON.parse(data) as { content?: string };
                if (parsed.content) {
                  onToken?.(parsed.content);
                }
              } catch {
                // Skip malformed events during streaming
              }
            }
          }
        }

        if (completed || abortController.signal.aborted) {
          break;
        }
      } catch (err) {
        if (abortController.signal.aborted || completed) break;

        onStatus?.("reconnecting");
        attempt++;

        if (attempt < SSE_MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            SSE_RECONNECT_BASE_MS * Math.pow(2, attempt - 1),
            SSE_RECONNECT_MAX_MS
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    if (!abortController.signal.aborted && !completed) {
      onStatus?.("disconnected");
    }
  })();

  return {
    abort: abortController,
    finished,
  };
}
