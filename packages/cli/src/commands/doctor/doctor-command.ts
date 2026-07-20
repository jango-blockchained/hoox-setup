/**
 * `hoox doctor` — diagnose global runtime / toolchain layout.
 *
 * Reports $HOME/.hoox, local vs global monorepo resolution, and TUI entry.
 * With `--fix-runtime`, clones hoox-setup into ~/.hoox/repo and installs deps.
 */
import { Command } from "commander";
import { spinner } from "@clack/prompts";
import {
  ensureGlobalRuntime,
  getRuntimeStatus,
} from "../../services/runtime/index.js";
import { theme, icons } from "../../utils/theme.js";
import {
  formatJson,
  formatSuccess,
  getFormatOptions,
} from "../../utils/formatters.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import { withErrorHandling } from "../../utils/error-handler.js";
import { startTimer } from "../../utils/timer.js";
import { formatDuration } from "../../utils/formatters.js";

function printStatus(): number {
  const status = getRuntimeStatus();
  const { runtime } = status;

  process.stdout.write(theme.heading("\nHoox doctor\n\n"));
  process.stdout.write(
    `${theme.dim("HOOX_HOME")}     ${status.hooxHome}\n` +
      `${theme.dim("Global repo")}  ${status.repoPath}\n` +
      `${theme.dim("Runtime root")} ${runtime.root ?? theme.warning("(none)")}\n` +
      `${theme.dim("Source")}       ${runtime.source}\n` +
      `${theme.dim("TUI entry")}    ${status.tuiEntry ?? theme.warning("(not found)")}\n\n`
  );

  // Global clone is optional when cwd / HOOX_REPO already resolves a monorepo.
  const globalRequired = runtime.root === null;
  const lines: {
    ok: boolean;
    required: boolean;
    label: string;
    detail?: string;
  }[] = [
    {
      ok: true,
      required: true,
      label: "Hoox home path",
      detail: status.hooxHome,
    },
    {
      ok: status.isSetupRoot,
      required: globalRequired,
      label: "Global runtime (~/.hoox/repo)",
      detail: status.isSetupRoot
        ? "hoox-setup markers present"
        : status.repoPresent
          ? "path exists but is not a setup monorepo"
          : runtime.root
            ? "optional (runtime resolved elsewhere)"
            : "missing — run: hoox doctor --fix-runtime",
    },
    {
      ok: runtime.root !== null,
      required: true,
      label: "Resolved runtime root",
      detail:
        runtime.root === null
          ? "set HOOX_REPO, cd into hoox-setup, or fix-runtime"
          : `${runtime.source}: ${runtime.root}`,
    },
    {
      ok: status.tuiEntry !== null,
      required: true,
      label: "TUI entry point",
      detail:
        status.tuiEntry ?? "packages/tui/src/main.tsx not found under runtime",
    },
  ];

  let failed = 0;
  for (const line of lines) {
    const warnOnly = !line.ok && !line.required;
    const icon = line.ok
      ? theme.success(icons.success)
      : warnOnly
        ? theme.warning(icons.warning)
        : theme.error(icons.error);
    if (!line.ok && line.required) failed++;
    process.stdout.write(`${icon} ${line.label}\n`);
    if (line.detail) {
      process.stdout.write(`   ${theme.dim(line.detail)}\n`);
    }
  }
  process.stdout.write("\n");

  if (failed > 0 || !status.isSetupRoot) {
    process.stdout.write(
      theme.dim(
        "Tip: HOOX_HOME overrides ~/.hoox · HOOX_REPO forces the monorepo path\n" +
          "     Outside a checkout: hoox doctor --fix-runtime\n\n"
      )
    );
  }

  return failed === 0 ? ExitCode.SUCCESS : ExitCode.ERROR;
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .summary("Diagnose global runtime and TUI paths")
    .description(
      `Check Hoox path layout: $HOME/.hoox, local monorepo detection, and TUI entry.

Resolution order for the tool/runtime root:
  1. HOOX_REPO environment variable
  2. Walk up from the current directory for a hoox-setup checkout
  3. $HOME/.hoox/repo (managed global clone)

EXAMPLES:
  hoox doctor
  hoox doctor --fix-runtime   Clone + bun install into ~/.hoox/repo
  HOOX_REPO=~/Git/hoox-setup hoox doctor`
    )
    .option(
      "--fix-runtime",
      "Clone hoox-setup into ~/.hoox/repo and install dependencies"
    )
    .option("--repo-url <url>", "Git URL used with --fix-runtime", undefined)
    .action(
      withErrorHandling(
        async (
          options: {
            fixRuntime?: boolean;
            repoUrl?: string;
          },
          cmd: Command
        ) => {
          const fmt = getFormatOptions(cmd);

          if (options.fixRuntime) {
            const s = spinner();
            const t = startTimer();
            s.start("Ensuring global Hoox runtime...");
            try {
              const result = await ensureGlobalRuntime({
                repoUrl: options.repoUrl,
                onLog: (msg) => {
                  s.message(msg);
                },
              });
              const dur = formatDuration(t.ms());
              s.stop(
                theme.success(
                  `Runtime ready at ${result.repoPath} (${dur})` +
                    (result.cloned ? " [cloned]" : "") +
                    (result.installed ? " [installed]" : "")
                )
              );
              if (fmt.json) {
                formatJson({ ...result, status: getRuntimeStatus() }, fmt);
              } else {
                formatSuccess(
                  result.tuiEntry
                    ? `TUI entry: ${result.tuiEntry}`
                    : "Runtime installed (TUI entry not found — check packages/tui)"
                );
                printStatus();
              }
              if (!result.tuiEntry) {
                process.exitCode = ExitCode.ERROR;
              }
            } catch (err) {
              s.stop(theme.error("Failed to fix runtime"));
              throw new CLIError(
                err instanceof Error ? err.message : String(err),
                ExitCode.ERROR
              );
            }
            return;
          }

          if (fmt.json) {
            formatJson(getRuntimeStatus(), fmt);
            const status = getRuntimeStatus();
            if (!status.runtime.root || !status.tuiEntry) {
              process.exitCode = ExitCode.ERROR;
            }
            return;
          }

          process.exitCode = printStatus();
        },
        { service: "doctor" }
      )
    );
}
