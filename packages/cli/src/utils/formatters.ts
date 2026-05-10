/**
 * Output formatters for the Hoox CLI.
 * Each function respects --json / --quiet flags passed via FormatOptions.
 * Human-readable mode uses ansis styling from the theme.
 */

import { CLIError, ExitCode } from "./errors.js";
import { theme, icons } from "./theme.js";

export interface FormatOptions {
  json?: boolean;
  quiet?: boolean;
}

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
 * Output tabular data.
 * - JSON mode:  JSON array of objects
 * - Quiet mode: prints nothing
 * - Human mode: box-drawn table with column headers
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
    widths[key] = key.length;
    for (const row of rows) {
      const value = row[key] ?? "";
      widths[key] = Math.max(widths[key], value.length);
    }
  }

  // Build top border
  const topParts = keys.map((k) => "─".repeat(widths[k] + 2));
  const topBorder = `┌${topParts.join("┬")}┐`;
  const sepBorder = `├${topParts.join("┼")}┤`;
  const botBorder = `└${topParts.join("┴")}┘`;

  // Header
  const headerCells = keys.map((k) => theme.bold(k.padEnd(widths[k])));
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
    `${theme.dim(topBorder)}\n${headerRow}\n${theme.dim(sepBorder)}\n${dataRows.join("\n")}\n${theme.dim(botBorder)}\n`
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
 * - Human mode: "label: value" with dimmed labels
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

  const maxKeyLen = Math.max(...Object.keys(pairs).map((k) => k.length));

  for (const [key, value] of Object.entries(pairs)) {
    const paddedKey = key.padEnd(maxKeyLen);
    process.stdout.write(`  ${theme.label(paddedKey)} ${value}\n`);
  }
}
