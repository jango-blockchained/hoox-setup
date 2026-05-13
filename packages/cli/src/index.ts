#!/usr/bin/env bun
/**
 * Hoox CLI — main entry point.
 * Built with commander.js. Commands are registered via dedicated register* functions.
 * Global options --json and --quiet are available to all commands via program.opts().
 */

import { Command } from "commander";
import { toError } from "@jango-blockchained/hoox-shared";
import { CLIError, ExitCode } from "./utils/errors.js";
import { formatError } from "./utils/formatters.js";
import { theme } from "./utils/theme.js";

// ---------------------------------------------------------------------------
// Program setup
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name("hoox")
  .description(
    "Hoox CLI — manage Cloudflare Workers, infrastructure, secrets, and deployments"
  )
  .version("0.2.0")
  .addHelpText(
    "beforeAll",
    theme.heading("\nHoox CLI — Cloudflare Workers Platform\n")
  )
  .configureHelp({
    styleTitle: (str: string) => theme.heading(str),
    styleCommandText: (str: string) => theme.bold(str),
    styleOptionText: (str: string) => str,
    styleDescriptionText: (str: string) => theme.dim(str),
  });

// Global options — accessible by all commands via program.opts()
program.option("--json", "Output in JSON format");
program.option("--quiet", "Minimal output");

// ---------------------------------------------------------------------------
// Error handling — map CommanderError and CLIError to proper exit codes
// ---------------------------------------------------------------------------

program.exitOverride((err) => {
  // Commander's own informational exits — let them through
  if (
    err.code === "commander.helpDisplayed" ||
    err.code === "commander.version"
  ) {
    process.exit(ExitCode.SUCCESS);
  }

  // Parent command without subcommand — already displayed help, clean exit
  if (
    err.code === "commander.missingArgument" ||
    err.message === "(outputHelp)" ||
    err.message?.includes("outputHelp")
  ) {
    process.exit(ExitCode.SUCCESS);
  }

  // Unknown command / option: exit code 2 (invalid usage)
  if (
    err.code === "commander.unknownCommand" ||
    err.code === "commander.unknownOption"
  ) {
    formatError(
      new CLIError(err.message, ExitCode.INVALID_USAGE, undefined, false)
    );
    process.exit(ExitCode.INVALID_USAGE);
  }

  // Missing mandatory option / argument: exit code 2 (invalid usage)
  if (
    err.code === "commander.missingMandatoryOptionValue" ||
    err.code === "commander.missingArgument"
  ) {
    formatError(
      new CLIError(err.message, ExitCode.INVALID_USAGE, undefined, false)
    );
    process.exit(ExitCode.INVALID_USAGE);
  }

  // If the error is already a CLIError, use its exit code
  if (err instanceof CLIError) {
    formatError(err);
    process.exit((err as CLIError).code);
  }

  // Generic fallback
  formatError(new CLIError(err.message, ExitCode.ERROR, undefined, false));
  process.exit(ExitCode.ERROR);
});

// ---------------------------------------------------------------------------
// Global process error handlers
// ---------------------------------------------------------------------------

process.on("uncaughtException", (err) => {
  formatError(
    err instanceof CLIError
      ? err
      : new CLIError(
          `Uncaught exception: ${err.message}`,
          ExitCode.ERROR,
          err.stack,
          false
        )
  );
  process.exit(ExitCode.ERROR);
});

process.on("unhandledRejection", (reason) => {
  const err =
    reason instanceof Error
      ? reason
      : new Error(`Unhandled rejection: ${toError(reason)}`);

  formatError(new CLIError(err.message, ExitCode.ERROR, err.stack, false));
  process.exit(ExitCode.ERROR);
});

// ---------------------------------------------------------------------------
// Command registration (added in subtasks 06–16)
// ---------------------------------------------------------------------------

import { registerInitCommand } from "./commands/init/index.js";
import { registerDevCommand } from "./commands/dev/index.js";
import { registerDeployCommand } from "./commands/deploy/index.js";
import { registerInfraCommand } from "./commands/infra/index.js";
import { registerConfigCommand } from "./commands/config/index.js";
import { registerCheckCommand } from "./commands/check/index.js";
import { registerLogsCommand } from "./commands/logs/index.js";
import { registerTestCommand } from "./commands/test/index.js";
import { registerWafCommand } from "./commands/waf/index.js";
import { registerCloneCommand } from "./commands/clone/index.js";
import { registerDashboardCommand } from "./commands/dashboard/index.js";
import { registerDbCommand } from "./commands/db/index.js";
import { runInteractiveTUI } from "./ui/index.js";

registerInitCommand(program);
registerDevCommand(program);
registerDeployCommand(program);
registerInfraCommand(program);
registerConfigCommand(program);
registerCheckCommand(program);
registerLogsCommand(program);
registerTestCommand(program);
registerWafCommand(program);
registerCloneCommand(program);
registerDashboardCommand(program);
registerDbCommand(program);

// ---------------------------------------------------------------------------
// Main entry — exported so bin/hoox.js can invoke it explicitly
// (import.meta.main is false when loaded as a dependency)
// ---------------------------------------------------------------------------

/**
 * Main CLI entry point.
 * Parses args or launches the interactive TUI if no args are given.
 */
export async function main(): Promise<void> {
  const hasArgs = process.argv.slice(2).length > 0;

  if (hasArgs) {
    program.parse();
  } else {
    // Interactive TUI mode — launches when hoox is called with no arguments
    await runInteractiveTUI(program);
    process.exit(ExitCode.SUCCESS);
  }
}

if (import.meta.main) {
  await main();
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { program };
export { CLIError, ExitCode } from "./utils/errors.js";
export {
  formatSuccess,
  formatError,
  formatTable,
  formatJson,
  formatKeyValue,
} from "./utils/formatters.js";
export type { FormatOptions } from "./utils/formatters.js";
export { theme, icons } from "./utils/theme.js";
