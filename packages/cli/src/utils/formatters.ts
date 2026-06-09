/**
 * Output formatters for the Hoox CLI.
 * Each function respects --json / --quiet flags passed via FormatOptions.
 * Human-readable mode uses ansis styling from the theme.
 */

import ansis from "ansis";
import { CLIError, ExitCode } from "./errors.js";
import { theme, icons, stripAnsi, hr } from "./theme.js";
import { formatDuration as _formatDuration } from "./timer.js";
import { isRichMode } from "./format-mode.js";
import { Command } from "commander";

export interface FormatOptions {
  json?: boolean;
  quiet?: boolean;
}

// ── Progress bar ──────────────────────────────────────────────────

const PROGRESS_BAR_WIDTH = 30;

/** Optional ETA context for `renderProgressBar`. */
export interface ProgressBarEta {
  /** When the operation started (ms since epoch). */
  startedAt: number;
  /** Optional known total duration; if omitted, ETA is estimated from rate. */
  totalMs?: number;
}

/**
 * Render an inline progress bar string.
 * @param current  Current step (0-based)
 * @param total    Total steps
 * @param opts     Width override, or ETA context
 */
export function renderProgressBar(
  current: number,
  total: number,
  opts?: { width?: number; eta?: ProgressBarEta }
): string {
  const width = opts?.width ?? PROGRESS_BAR_WIDTH;
  const ratio = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(width * ratio);
  const empty = width - filled;
  const pct = Math.round(ratio * 100);

  const bar =
    theme.accent("[") +
    theme.success("█".repeat(filled)) +
    theme.dim("░".repeat(empty)) +
    theme.accent("]") +
    ` ${pct}%`;

  if (!opts?.eta || total === 0) return bar;

  // ETA — show elapsed / (estimated total) or elapsed / known total
  const elapsed = Date.now() - opts.eta.startedAt;
  let etaSuffix: string;
  if (opts.eta.totalMs) {
    etaSuffix = `  ${_formatDuration(elapsed)} / ${_formatDuration(opts.eta.totalMs)}`;
  } else if (current > 0) {
    const estimatedTotal = (elapsed / current) * total;
    const remaining = Math.max(0, estimatedTotal - elapsed);
    etaSuffix = `  ${_formatDuration(elapsed)} / ~${_formatDuration(estimatedTotal)} (${_formatDuration(remaining)} left)`;
  } else {
    etaSuffix = `  ${_formatDuration(elapsed)}`;
  }

  return bar + theme.dim(etaSuffix);
}

/**
 * Render a multi-line progress display for sequential steps.
 * Returns lines suitable for overwriting via \r or manual clear.
 */
export function renderStepProgress(
  steps: Array<{
    name: string;
    status: "pending" | "running" | "done" | "failed";
  }>
): string {
  const iconMap: Record<string, string> = {
    pending: theme.dim("○"),
    running: theme.info("◌"),
    done: theme.success("●"),
    failed: theme.error("✗"),
  };

  return steps
    .map((s) => `  ${iconMap[s.status]} ${theme.bold(s.name)}`)
    .join("\n");
}

// ── Polish helpers ────────────────────────────────────────────────

/**
 * Format a duration in human-readable form.
 * Re-exported from `timer.ts` so callers can import everything from
 * `formatters.js`.
 */
export const formatDuration = _formatDuration;

/** Semantic log level for `formatBadge`. */
export type BadgeLevel = "ok" | "warn" | "err" | "info";

const BADGE_STYLE: Record<
  BadgeLevel,
  { bg: typeof ansis.bgGreen; fg: typeof ansis.black }
> = {
  ok: { bg: ansis.bgGreen, fg: ansis.black },
  warn: { bg: ansis.bgYellow, fg: ansis.black },
  err: { bg: ansis.bgRed, fg: ansis.white },
  info: { bg: ansis.bgBlue, fg: ansis.white },
};

/**
 * Render a short status badge (e.g. " OK ", " FAIL ") with the appropriate
 * theme color. Useful in tables and inline lists.
 */
export function formatBadge(level: BadgeLevel, text?: string): string {
  const content = (text ?? defaultBadgeLabel(level)).padEnd(4, " ");
  const { bg, fg } = BADGE_STYLE[level];
  return bg(fg(` ${content} `));
}

function defaultBadgeLabel(level: BadgeLevel): string {
  switch (level) {
    case "ok":
      return "OK";
    case "warn":
      return "WARN";
    case "err":
      return "FAIL";
    case "info":
      return "INFO";
  }
}

/**
 * Print a short, dimmed hint line below the previous output.
 * Suppressed in --json / --quiet modes.
 */
export function formatHint(hint: string, opts?: FormatOptions): void {
  if (opts?.quiet || opts?.json) return;
  if (!isRichMode(opts)) return;
  process.stdout.write(`${theme.dim("↳ hint:")} ${theme.value(hint)}\n`);
}

// ── Basic output ──────────────────────────────────────────────────

/**
 * Output a success message.
 * - JSON mode:  {"success":true,"message":"..."}
 * - Quiet mode: prints nothing
 * - Human mode: green "✓ message"
 */
export function formatSuccess(message: string, opts?: FormatOptions): void {
  if (opts?.quiet) return;

  if (opts?.json) {
    process.stdout.write(JSON.stringify({ success: true, message }) + "\n");
    return;
  }

  process.stdout.write(`${theme.success(icons.success)} ${message}\n`);
}

/**
 * Output an error message.
 * - JSON mode:  {"success":false,"error":"...","code":1,"details":"...","hint":"..."}
 *               (hint is additive — older consumers ignore unknown fields.)
 * - Quiet mode: prints only the error message (no icon)
 * - Human mode: red "✗ message" + optional details indented + optional hint line
 */
export function formatError(error: Error | string, opts?: FormatOptions): void {
  const message = typeof error === "string" ? error : error.message;
  const cliError = error instanceof CLIError ? error : null;

  if (opts?.json) {
    const output: Record<string, unknown> = {
      success: false,
      error: message,
      code: cliError?.code ?? ExitCode.ERROR,
    };
    if (cliError?.details) {
      output.details = cliError.details;
    }
    if (cliError?.hint) {
      output.hint = cliError.hint;
    }
    process.stdout.write(JSON.stringify(output) + "\n");
    return;
  }

  if (opts?.quiet) {
    process.stdout.write(`${message}\n`);
    return;
  }

  process.stdout.write(`${theme.error(icons.error)} ${message}\n`);

  if (cliError?.details) {
    process.stdout.write(`  ${theme.dim(cliError.details)}\n`);
  }
  if (cliError?.hint) {
    process.stdout.write(
      `${theme.dim("↳ hint:")} ${theme.value(cliError.hint)}\n`
    );
  }
}

/**
 * Output tabular data with enhanced box-drawing borders.
 * - JSON mode:  JSON array of objects
 * - Quiet mode: prints nothing
 * - Human mode: themed box-drawn table with column headers
 */
export function formatTable(
  rows: Record<string, string>[],
  opts?: FormatOptions
): void {
  if (opts?.quiet) return;

  if (opts?.json) {
    process.stdout.write(JSON.stringify(rows, null, 2) + "\n");
    return;
  }

  if (rows.length === 0) {
    process.stdout.write(`${theme.dim("(empty)")}\n`);
    return;
  }

  // Collect all keys in display order (first row defines column order)
  const keys = Object.keys(rows[0]);

  // Calculate column widths
  const widths: Record<string, number> = {};
  for (const key of keys) {
    widths[key] = stripAnsi(key).length;
    for (const row of rows) {
      const value = row[key] ?? "";
      const stripped = stripAnsi(value).length;
      widths[key] = Math.max(widths[key], stripped);
    }
  }

  // Build border segments
  const topParts = keys.map((k) => "─".repeat(widths[k] + 2));
  const topBorder = `┌${topParts.join("┬")}┐`;
  const sepBorder = `├${topParts.join("┼")}┤`;
  const botBorder = `└${topParts.join("┴")}┘`;

  // Header row with themed styling
  const headerCells = keys.map((k) =>
    theme.bold(k.padEnd(widths[k])).toString()
  );
  const headerRow = `│ ${headerCells.join(" │ ")} │`;

  // Data rows
  const dataRows = rows.map((row) => {
    const cells = keys.map((k) => {
      const value = row[k] ?? "";
      return value.padEnd(widths[k]);
    });
    return `│ ${cells.join(" │ ")} │`;
  });

  process.stdout.write(
    `${theme.dim(topBorder)}\n` +
      `${headerRow}\n` +
      `${theme.dim(sepBorder)}\n` +
      `${dataRows.join("\n")}\n` +
      `${theme.dim(botBorder)}\n`
  );
}

/**
 * Output arbitrary data as JSON.
 * - JSON / Quiet mode: JSON stringified (compact or pretty)
 * - Human mode:    JSON with 2-space indent
 */
export function formatJson(data: unknown, opts?: FormatOptions): void {
  const json = opts?.quiet
    ? JSON.stringify(data)
    : JSON.stringify(data, null, 2);

  process.stdout.write(`${json}\n`);
}

/**
 * Output key-value pairs.
 * - JSON mode:  JSON object
 * - Quiet mode: prints nothing
 * - Human mode: "label: value" with themed labels
 */
export function formatKeyValue(
  pairs: Record<string, string>,
  opts?: FormatOptions
): void {
  if (opts?.quiet) return;

  if (opts?.json) {
    process.stdout.write(JSON.stringify(pairs, null, 2) + "\n");
    return;
  }

  const maxKeyLen = Math.max(
    ...Object.keys(pairs).map((k) => stripAnsi(k).length)
  );

  for (const [key, value] of Object.entries(pairs)) {
    const paddedKey = key.padEnd(maxKeyLen);
    process.stdout.write(
      `  ${theme.key(paddedKey)} ${theme.dim(":")} ${value}\n`
    );
  }
}

/**
 * Output a section header with decorative separator.
 */
export function formatHeader(text: string, opts?: FormatOptions): void {
  if (opts?.quiet) return;
  if (opts?.json) return;

  process.stdout.write(`\n${theme.heading(text)}\n`);
  process.stdout.write(`${hr()}\n`);
}

/**
 * Output a bullet-point list with optional icon per item.
 */
export function formatList(
  items: string[],
  opts?: { icon?: string; json?: boolean; quiet?: boolean }
): void {
  if (opts?.quiet) return;

  if (opts?.json) {
    process.stdout.write(JSON.stringify(items, null, 2) + "\n");
    return;
  }

  const icon = opts?.icon ?? icons.arrow;
  for (const item of items) {
    process.stdout.write(`  ${icon} ${item}\n`);
  }
}

/**
 * Build the format options for output, reading global --json / --quiet flags.
 * Uses `optsWithGlobals()` to include options inherited from the top-level program.
 */
export function getFormatOptions(cmd: Command): FormatOptions {
  const opts = cmd.optsWithGlobals();
  return { json: Boolean(opts.json), quiet: Boolean(opts.quiet) };
}
