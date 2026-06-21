/**
 * Shared CLI error-handling wrapper.
 *
 * Provides a `withErrorHandling()` higher-order function that wraps command
 * handlers with standardized error formatting and exit-code management,
 * eliminating ~23 duplicated try/catch blocks across command files.
 *
 * Inner/recoverable try/catch blocks (e.g. JSON parse, per-key KV errors,
 * API network errors) are left in place — only the outermost handler-level
 * catch-all is replaced.
 */

import { formatError } from "./formatters.js";
import { CLIError, ExitCode } from "./errors.js";
import type { FormatOptions } from "./formatters.js";

export type CommandResult = Promise<void>;

/**
 * Wraps a command handler with standardized error handling.
 *
 * @param handler - The command action function to wrap
 * @param options.service - Service name for error prefix (e.g. "db", "kv")
 * @param options.opts   - Optional FormatOptions for JSON/quiet-aware output
 *
 * @returns A wrapped function that catches errors, formats them, and exits
 *
 * @example
 * ```ts
 * .action(withErrorHandling(async (cmd) => {
 *   const opts = getFormatOptions(cmd);
 *   // …command logic…
 * }, { service: "db" }))
 * ```
 */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<void>,
  options?: { service?: string; opts?: FormatOptions }
): (...args: T) => CommandResult {
  return async (...args: T) => {
    try {
      await handler(...args);
    } catch (error) {
      const service = options?.service ?? "cli";

      if (error instanceof CLIError) {
        formatError(error, options?.opts);
        process.exitCode = error.code;
        process.exit(error.code);
      } else if (error instanceof Error) {
        formatError(`[${service}] ${error.message}`, options?.opts);
        process.exitCode = ExitCode.ERROR;
        process.exit(ExitCode.ERROR);
      } else {
        formatError(
          `[${service}] Unknown error: ${String(error)}`,
          options?.opts
        );
        process.exitCode = ExitCode.CommandFailed;
        process.exit(ExitCode.CommandFailed);
      }
    }
  };
}
