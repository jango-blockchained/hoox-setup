#!/usr/bin/env bun
/**
 * Hoox CLI — main entry point.
 * Built with commander.js. Commands are registered via dedicated register* functions.
 * Global options --json and --quiet are available to all commands via program.opts().
 */

import { readFileSync } from "node:fs";
import { Command } from "commander";
import { toError } from "@jango-blockchained/hoox-shared";
import { COPYRIGHT } from "@jango-blockchained/hoox-shared/legal";
import { CLIError, ExitCode } from "./utils/errors.js";
import { formatError, formatCompletion } from "./utils/formatters.js";
import { suggestForCommand } from "./utils/error-handler.js";
import { theme } from "./utils/theme.js";
import { renderHelp } from "./utils/help-formatter.js";
import { suggestNextCommand, getCmdPath } from "./utils/completion.js";

// ---------------------------------------------------------------------------
// Program setup
// ---------------------------------------------------------------------------

// Load version from package.json at module init time (synchronous to support
// Commander's .version() call, which runs during program initialization)
const pkgVersion: string = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf-8")
).version;

const program = new Command();

program
  .name("hoox")
  .description(
    "Hoox CLI — manage Cloudflare Workers, infrastructure, secrets, and deployments"
  )
  .version(`${pkgVersion}\n\n${COPYRIGHT}`)
  .addHelpText(
    "beforeAll",
    theme.heading("\nHoox CLI — Cloudflare Workers Platform\n")
  )
  .configureHelp({
    // Cast the helper param: renderHelp accepts the standard
    // helpInformation signature but Commander types it as Help class.
    formatHelp: (cmd, helper) => renderHelp(cmd, helper as never),
    styleTitle: (str: string) => theme.heading(str),
    styleCommandText: (str: string) => theme.bold(str),
    styleOptionText: (str: string) => str,
    styleDescriptionText: (str: string) => theme.dim(str),
  });

// Global options — accessible by all commands via program.opts()
program.option("--json", "Output in JSON format");
program.option("--quiet", "Minimal output");
program.option("--no-color", "Disable color output");
program.option("-y, --yes", "Skip confirmation prompts");

// ---------------------------------------------------------------------------
// Completion hooks — stamp start time + print footer on success
// ---------------------------------------------------------------------------

// Stamp a start time on each leaf command.
program.hook("preAction", (thisCmd) => {
  (thisCmd as Command & { _hooxStartedAt?: number })._hooxStartedAt =
    Date.now();
});

// Print a completion footer after each successful command.
program.hook("postAction", (thisCmd) => {
  // postAction does not fire if the action threw, but be defensive
  // about callers that set process.exitCode explicitly.
  if (process.exitCode && process.exitCode !== 0) return;
  const startedAt = (thisCmd as Command & { _hooxStartedAt?: number })
    ._hooxStartedAt;
  if (startedAt === undefined) return; // preAction didn't run — skip
  const durationMs = Date.now() - startedAt;
  const path = getCmdPath(thisCmd);
  const suggestion = suggestNextCommand(path);
  formatCompletion("Done", { durationMs, suggestion });
});

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
  if (err.code === "commander.unknownCommand") {
    // Try to extract the bad arg and find a similar command.
    const match = err.message.match(/'([^']+)'/);
    const badArg = match?.[1] ?? "";
    const suggestion = suggestForCommand(program, badArg);
    formatError(
      new CLIError(err.message, ExitCode.INVALID_USAGE, undefined, false),
      suggestion ? { suggestions: [suggestion] } : undefined
    );
    process.exit(ExitCode.INVALID_USAGE);
  }
  if (err.code === "commander.unknownOption") {
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
import { registerOnboardCommand } from "./commands/onboard/index.js";
import { WIZARD_STATE_PATH } from "@jango-blockchained/hoox-shared";
import { registerDevCommand } from "./commands/dev/index.js";
import { registerDeployCommand } from "./commands/deploy/index.js";
import { registerInfraCommand } from "./commands/infra/index.js";
import { registerConfigCommand } from "./commands/config/index.js";
import { registerSecretsCommand } from "./commands/secrets/index.js";
import { registerKeysCommand } from "./commands/keys/index.js";
import { registerCheckCommand } from "./commands/check/index.js";
import { registerLogsCommand } from "./commands/logs/index.js";
import { registerTestCommand } from "./commands/test/index.js";
import { registerWafCommand } from "./commands/waf/index.js";
import { registerCloneCommand } from "./commands/clone/index.js";
import { registerDashboardCommand } from "./commands/dashboard/index.js";
import { registerDbCommand } from "./commands/db/index.js";
import { registerMonitorCommand } from "./commands/monitor/index.js";
import { registerWorkersCommand } from "./commands/workers/index.js";
import { registerRepairCommand } from "./commands/repair/index.js";
import { registerUpdateCommand } from "./commands/update/index.js";
import { registerSchemaCommand } from "./commands/schema/index.js";
import { registerTUICommand } from "./commands/tui/index.js";
import { registerDisclaimerCommand } from "./commands/disclaimer/index.js";
import { registerAgentCommand } from "./commands/agent/index.js";
import { registerSetupCommand } from "./commands/setup/index.js";
import { registerTraceCommand } from "./commands/trace/index.js";
import { registerPerfCommand } from "./commands/perf/index.js";
import { runInteractiveTUI } from "./ui/index.js";

// ── Command registration ────────────────────────────────────────────────

registerInitCommand(program);
registerOnboardCommand(program);
registerDevCommand(program);
registerDeployCommand(program);
registerInfraCommand(program);
registerConfigCommand(program);
registerSecretsCommand(program);
registerKeysCommand(program);
registerCheckCommand(program);
registerLogsCommand(program);
registerTestCommand(program);
registerWafCommand(program);
registerCloneCommand(program);
registerDashboardCommand(program);
registerDbCommand(program);
registerMonitorCommand(program);
registerWorkersCommand(program);
registerRepairCommand(program);
registerSchemaCommand(program);
registerUpdateCommand(program);
registerTUICommand(program);
registerDisclaimerCommand(program);
registerAgentCommand(program);
registerSetupCommand(program);
registerTraceCommand(program);
registerPerfCommand(program);

// ---------------------------------------------------------------------------
// Shell completion command
// ---------------------------------------------------------------------------

program
  .command("completion")
  .description("Generate shell completion script")
  .argument("[shell]", "Shell type (bash, zsh, fish)")
  .action(async (shell?: string) => {
    if (!shell) {
      process.stdout.write("Usage: hoox completion <bash|zsh|fish>\n");
      return;
    }

    const validShells = ["bash", "zsh", "fish"];
    if (!validShells.includes(shell)) {
      process.stderr.write(
        `Unsupported shell "${shell}". Use: ${validShells.join(", ")}\n`
      );
      process.exitCode = 1;
      return;
    }

    // Generate completion script
    if (shell === "bash") {
      process.stdout.write(`_hoox_completion() {
  local cur prev opts
  COMPREPLY=()
  cur="\${COMP_WORDS[COMP_CWORD]}"
    opts="--help --version --json --quiet --yes init onboard bootstrap quickstart setup clone dev deploy infra config secrets keys check db monitor repair logs test waf dashboard schema update tui disclaimer agent workers trace perf"
  COMPREPLY=( $(compgen -W "\${opts}" -- \${cur}) )
  return 0
}
complete -F _hoox_completion hoox
`);
    } else if (shell === "zsh") {
      process.stdout.write(`#compdef hoox
_hoox() {
  local -a opts
  opts=(
    '--help:Show help'
    '--version:Show version'
    '--json:JSON output'
    '--quiet:Minimal output'
    'init:Interactive setup wizard (config only)'
    'onboard:One-shot full bootstrap (init + setup)'
    'setup:Auto-bootstrap infrastructure'
    'secrets:Manage Cloudflare Worker secrets'
    'keys:Manage internal auth keys'
    'clone:Clone worker repositories'
    'dev:Local development'
    'deploy:Deploy to Cloudflare'
    'infra:Manage infrastructure'
    'config:Manage configuration'
    'check:Validate and health-check'
    'db:Database operations'
    'monitor:Monitor system'
    'repair:Repair system'
    'logs:View worker logs'
    'test:Run tests'
    'waf:Manage Web Application Firewall'
    'dashboard:Dashboard operations'
    'workers:Worker operations',
    'trace:Query and manage Workers traces'
    'perf:Performance measurement tools'
    'agent:AI agent operations'
  )
  _describe 'hoox' opts
}
compdef _hoox hoox
`);
    }
  });

// ---------------------------------------------------------------------------
// preAction hooks — auto-check wrangler version before dev/deploy
// ---------------------------------------------------------------------------

import { UpdateService } from "./services/update/index.js";

const devCmd = program.commands.find((c) => c.name() === "dev");
if (devCmd) {
  const devStartCmd = devCmd.commands.find((c) => c.name() === "start");
  if (devStartCmd) {
    devStartCmd.hook("preAction", async () => {
      const service = new UpdateService();
      await service.checkAndPromptUpdate({ yes: program.opts().yes });
    });
  }
}

const deployCmd = program.commands.find((c) => c.name() === "deploy");
if (deployCmd) {
  const deploySubs = ["all", "workers", "worker", "dashboard"];
  for (const sub of deploySubs) {
    const cmd = deployCmd.commands.find((c) => c.name() === sub);
    if (cmd) {
      cmd.hook("preAction", async () => {
        const service = new UpdateService();
        await service.checkAndPromptUpdate({ yes: program.opts().yes });
      });
    }
  }
}

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
    // Auto-launch the setup wizard if not yet initialized
    const configFile = Bun.file("wrangler.jsonc");
    const hasConfig = await configFile.exists();
    const wizardStateFile = Bun.file(WIZARD_STATE_PATH);
    const hasWizardState = await wizardStateFile.exists();

    if (!hasConfig) {
      // No wrangler.jsonc → project is uninitialized → auto-run the
      // recommended one-shot bootstrap. This chains init (config) + setup
      // (infrastructure) so the user gets a fully operational system.
      // For finer control, run 'hoox init' and 'hoox setup' separately.
      const args = hasWizardState ? ["onboard", "--resume"] : ["onboard"];
      await program.parseAsync(args, { from: "user" });
      process.exit(ExitCode.SUCCESS);
    }

    // Clean up stale wizard state if project is already initialized
    if (hasWizardState) {
      await Bun.write(WIZARD_STATE_PATH, "");
    }

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

// Exported services — usable by other packages / code
export { SetupService } from "./services/setup/index.js";
export type {
  GeneratedKeys,
  SetupOptions,
  SetupResult,
  SetupStepResult,
  SecretResult,
  ProgressEvent,
  ProgressCallback,
} from "./services/setup/index.js";
