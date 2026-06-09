/**
 * Decide whether "rich" terminal output is appropriate.
 *
 * Rich output (spinners, progress bars, color, badges) is suppressed in three
 * cases:
 *   1. `--json` flag is set (script consumers expect machine-readable output).
 *   2. `--quiet` flag is set (user asked for minimal output).
 *   3. stdout is not a TTY (piped, redirected, or running under CI).
 *
 * Centralising this check in one helper keeps every formatter honest: any
 * caller can ask "is rich mode right now?" and get the same answer.
 */

import type { FormatOptions } from "./formatters.js";

export function isRichMode(opts?: FormatOptions): boolean {
  if (opts?.json || opts?.quiet) return false;
  // In test environments, process.stdout.isTTY is usually undefined. Treat
  // undefined as "not a TTY" so we never accidentally emit ansi codes into
  // captured test output.
  return Boolean(process.stdout.isTTY);
}
