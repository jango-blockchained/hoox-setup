/**
 * TUI dev logger — file-backed diagnostics that never touch stdout/stderr
 * (those would corrupt the OpenTUI alternate screen).
 *
 * Enable with any of:
 *   - `hoox tui --debug`
 *   - `HOOX_DEBUG=1` / `TUI_DEBUG=1` / `true` / `yes`
 *
 * Writes append-only JSON lines to `$HOME/.hoox/.tui-state/debug.log`.
 */
import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { getTuiStateDir } from "./hoox-path-service";

export type DevLogLevel = "debug" | "info" | "warn" | "error";

export interface DevLogEntry {
  ts: string;
  level: DevLogLevel;
  scope: string;
  message: string;
  context?: Record<string, unknown>;
}

const DEBUG_LOG_FILE = "debug.log";

let enabledCache: boolean | null = null;
let logPathCache: string | null = null;
let ensureDirPromise: Promise<string> | null = null;

/** Reset caches (tests only). */
export function resetDevLogForTests(): void {
  enabledCache = null;
  logPathCache = null;
  ensureDirPromise = null;
}

/**
 * Whether dev logging is active for this process.
 * Cached after first read so hot paths stay cheap.
 */
export function isDevLogEnabled(): boolean {
  if (enabledCache !== null) return enabledCache;
  const v = process.env.HOOX_DEBUG ?? process.env.TUI_DEBUG ?? "";
  enabledCache = v === "1" || v === "true" || v === "yes";
  return enabledCache;
}

/** Absolute path to the debug log file (even if logging is disabled). */
export function getDevLogPath(): string {
  if (logPathCache) return logPathCache;
  logPathCache = join(getTuiStateDir(), DEBUG_LOG_FILE);
  return logPathCache;
}

async function ensureLogDir(): Promise<string> {
  if (!ensureDirPromise) {
    const dir = getTuiStateDir();
    ensureDirPromise = mkdir(dir, { recursive: true }).then(() => dir);
  }
  return ensureDirPromise;
}

function serializeContext(
  context?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!context) return undefined;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    // Avoid dumping secrets if callers slip them into context
    if (/token|secret|password|key|authorization/i.test(key)) {
      out[key] =
        typeof value === "string" && value.length > 0 ? "[redacted]" : value;
      continue;
    }
    if (value instanceof Error) {
      out[key] = { name: value.name, message: value.message };
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * Append one structured log line. No-op when debug is disabled.
 * Failures are swallowed — logging must never crash the TUI.
 */
export async function devLog(
  level: DevLogLevel,
  scope: string,
  message: string,
  context?: Record<string, unknown>
): Promise<void> {
  if (!isDevLogEnabled()) return;

  const entry: DevLogEntry = {
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...(context ? { context: serializeContext(context) } : {}),
  };

  try {
    await ensureLogDir();
    await appendFile(getDevLogPath(), `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // Swallow — alternate-screen UI must stay intact
  }
}

/** Convenience helpers. */
export const tuiDevLog = {
  debug: (scope: string, message: string, context?: Record<string, unknown>) =>
    devLog("debug", scope, message, context),
  info: (scope: string, message: string, context?: Record<string, unknown>) =>
    devLog("info", scope, message, context),
  warn: (scope: string, message: string, context?: Record<string, unknown>) =>
    devLog("warn", scope, message, context),
  error: (scope: string, message: string, context?: Record<string, unknown>) =>
    devLog("error", scope, message, context),
};
