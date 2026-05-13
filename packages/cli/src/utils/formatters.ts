/**
 * Output formatters for the Hoox CLI.
 * Each function respects --json / --quiet flags passed via FormatOptions.
 * Human-readable mode uses ansis styling from the theme.
 */

import { CLIError, ExitCode } from "./errors.js";
import { theme, icons, stripAnsi, hr } from "./theme.js";

export interface FormatOptions {
  json?: boolean;
  quiet?: boolean;
}

// ── Progress bar ──────────────────────────────────────────────────

const PROGRESS_BAR_WIDTH = 30;

/**
 * Render an inline progress bar string.
 * @param current  Current step (0-based)
 * @param total    Total steps
 * @param opts     Width override
 */
export function renderProgressBar(
  current: number,
  total: number,
  opts?: { width?: number }
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

  return bar;
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
 * - JSON mode:  {"success":false,"error":"...","code":1,"details":"..."}
 * - Quiet mode: prints only the error message (no icon)
 * - Human mode: red "✗ message" + optional details indented
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
