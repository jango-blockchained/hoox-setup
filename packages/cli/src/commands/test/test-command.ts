/**
 * `hoox test` command group — run tests and CI pipeline.
 *
 * Subcommands:
 *   all         — Run full CI pipeline (lint → typecheck → unit → integration)
 *   unit        — Run bun test (unit tests)
 *   integration — Run vitest integration tests
 *   worker      — Run tests for a specific worker directory
 */
import { Command } from "commander";
import { spinner } from "@clack/prompts";
import { ConfigService } from "../../services/config/index.js";
import { theme, icons } from "../../utils/theme.js";
import {
  formatSuccess,
  formatError,
  formatTable,
  formatJson,
} from "../../utils/formatters.js";
import { CLIError, ExitCode } from "../../utils/errors.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result of a single pipeline step or test run. */
export interface TestStepResult {
  /** Human-readable step name (e.g. "Lint", "Unit Tests"). */
  step: string;
  /** The raw command string that was executed. */
  command: string;
  /** Whether the step exited with code 0. */
  success: boolean;
  /** Process exit code (null if the process failed to spawn). */
  exitCode: number | null;
  /** Wall-clock duration in milliseconds. */
  duration: number;
  /** Captured stdout (trimmed). */
  output?: string;
  /** Captured stderr or exception message. */
  error?: string;
}

/** Aggregated summary of a test pipeline run. */
export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  results: TestStepResult[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFormatOptions(cmd: Command) {
  const opts = cmd.optsWithGlobals();
  return { json: Boolean(opts.json), quiet: Boolean(opts.quiet) };
}

/**
 * Spawn a command with stdout/stderr piped, capture output, and return a
 * structured result. Does NOT print anything — the caller decides display.
 */
export async function runStep(
  args: string[],
  cwd?: string,
): Promise<TestStepResult> {
  const command = args.join(" ");
  const start = Date.now();

  try {
    const proc = Bun.spawn(args, {
      cwd: cwd ?? process.cwd(),
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const duration = Date.now() - start;

    return {
      step: command,
      command,
      success: exitCode === 0,
      exitCode,
      duration,
      output: stdout.trim() || undefined,
      error: stderr.trim() ? stderr.trim() : undefined,
    };
  } catch (err) {
    return {
      step: command,
      command,
      success: false,
      exitCode: null,
      duration: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Spawn a command with stdout/stderr inherited so the user sees live output.
 * Returns a minimal result with exit code.
 */
async function runWithInherit(
  args: string[],
  cwd?: string,
): Promise<TestStepResult> {
  const command = args.join(" ");
  const start = Date.now();

  try {
    const proc = Bun.spawn(args, {
      cwd: cwd ?? process.cwd(),
      stdout: "inherit",
      stderr: "inherit",
    });
    const exitCode = await proc.exited;
    const duration = Date.now() - start;

    return {
      step: command,
      command,
      success: exitCode === 0,
      exitCode,
      duration,
    };
  } catch (err) {
    return {
      step: command,
      command,
      success: false,
      exitCode: null,
      duration: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Print a pipeline summary table (or JSON if --json is set).
 * Quiet mode suppresses all output.
 */
export function printSummary(
  summary: TestSummary,
  opts: { json?: boolean; quiet?: boolean },
): void {
  if (opts.quiet) return;

  if (opts.json) {
    formatJson(summary, opts);
    return;
  }

  const rows = summary.results.map((r) => ({
    Step: r.step,
    Status: r.success ? "passed" : "failed",
    Time: `${r.duration}ms`,
  }));

  formatTable(rows, opts);

  // Final status line
  if (summary.failed > 0) {
    formatError(
      new CLIError(
        `${summary.passed}/${summary.total} passed — ${summary.failed} failed`,
        ExitCode.ERROR,
      ),
      opts,
    );
  } else {
    formatSuccess(`All ${summary.total} steps passed`, opts);
  }
}

// ---------------------------------------------------------------------------
// Pipeline step definitions for `all` subcommand
// ---------------------------------------------------------------------------

const PIPELINE_STEPS: { label: string; args: string[] }[] = [
  { label: "Lint", args: ["bun", "run", "lint"] },
  { label: "TypeCheck", args: ["bun", "run", "typecheck"] },
  { label: "Unit Tests", args: ["bun", "test", "--coverage"] },
  {
    label: "Integration Tests",
    args: ["vitest", "run", "--config", "vitest.config.ts"],
  },
];

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

/**
 * Register the `hoox test` command group with subcommands:
 * all, unit, integration, worker.
 */
export function registerTestCommand(program: Command): void {
  const testCmd = program
    .command("test")
    .description("Run tests and CI pipeline");

  // -- test all ----------------------------------------------------------
  testCmd
    .command("all")
    .description(
      "Run full CI pipeline: lint → typecheck → unit tests → integration tests",
    )
    .option("--json", "Output results as JSON")
    .action(async (options: { json?: boolean }) => {
      const fmt = getFormatOptions(program);
      // Allow local --json to override global
      const useJson = options.json || fmt.json;
      const opts = { json: useJson, quiet: fmt.quiet };

      const results: TestStepResult[] = [];
      const s = spinner();
      s.start("Running CI pipeline...");

      try {
        for (const step of PIPELINE_STEPS) {
          s.message(`${theme.info(icons.info)} ${step.label}...`);
          const result = await runStep(step.args, process.cwd());
          results.push({ ...result, step: step.label });

          if (result.success) {
            s.message(
              `  ${theme.success(icons.success)} ${step.label} passed (${result.duration}ms)`,
            );
          } else {
            s.message(
              `  ${theme.error(icons.error)} ${step.label} failed (${result.duration}ms)`,
            );
            if (result.error) {
              s.message(theme.dim(result.error.slice(0, 500)));
            }
            // Stop on first failure
            break;
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(message, opts);
        process.exitCode = ExitCode.ERROR;
        s.stop("Pipeline aborted with unexpected error");
        return;
      }

      const summary: TestSummary = {
        total: results.length,
        passed: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      };

      s.stop(
        summary.failed > 0
          ? `Pipeline complete: ${summary.passed} passed, ${summary.failed} failed`
          : "Pipeline complete",
      );

      printSummary(summary, opts);

      if (summary.failed > 0) {
        process.exitCode = ExitCode.ERROR;
      }
    });

  // -- test unit ---------------------------------------------------------
  testCmd
    .command("unit")
    .description("Run unit tests with bun test")
    .option("--coverage", "Run with coverage reporting")
    .action(async (options: { coverage?: boolean }) => {
      const fmt = getFormatOptions(program);
      const args = ["bun", "test"];
      if (options.coverage) args.push("--coverage");

      const result = await runWithInherit(args, process.cwd());

      if (result.success) {
        formatSuccess("Unit tests passed", fmt);
      } else {
        formatError(
          new CLIError(
            `Unit tests failed (exit code ${result.exitCode})`,
            ExitCode.ERROR,
          ),
          fmt,
        );
        process.exitCode = ExitCode.ERROR;
      }
    });

  // -- test integration --------------------------------------------------
  testCmd
    .command("integration")
    .description("Run integration tests with vitest")
    .option("--coverage", "Run with coverage reporting")
    .action(async (options: { coverage?: boolean }) => {
      const fmt = getFormatOptions(program);
      const args = ["vitest", "run", "--config", "vitest.config.ts"];
      if (options.coverage) args.push("--coverage");

      const result = await runWithInherit(args, process.cwd());

      if (result.success) {
        formatSuccess("Integration tests passed", fmt);
      } else {
        formatError(
          new CLIError(
            `Integration tests failed (exit code ${result.exitCode})`,
            ExitCode.ERROR,
          ),
          fmt,
        );
        process.exitCode = ExitCode.ERROR;
      }
    });

  // -- test worker <name> ------------------------------------------------
  testCmd
    .command("worker <name>")
    .description("Run tests for a specific worker by name")
    .option("--coverage", "Run with coverage reporting")
    .action(async (name: string, options: { coverage?: boolean }) => {
      const fmt = getFormatOptions(program);

      try {
        const configService = new ConfigService();
        await configService.load();
        const workerConfig = configService.getWorker(name);

        if (!workerConfig) {
          formatError(
            new CLIError(
              `Worker "${name}" not found in workers.jsonc`,
              ExitCode.INVALID_USAGE,
            ),
            fmt,
          );
          process.exitCode = ExitCode.INVALID_USAGE;
          return;
        }

        const workerDir = `${process.cwd()}/${workerConfig.path}`;
        const args = ["bun", "test"];
        if (options.coverage) args.push("--coverage");

        const result = await runWithInherit(args, workerDir);

        if (result.success) {
          formatSuccess(`Worker "${name}" tests passed`, fmt);
        } else {
          formatError(
            new CLIError(
              `Worker "${name}" tests failed (exit code ${result.exitCode})`,
              ExitCode.ERROR,
            ),
            fmt,
          );
          process.exitCode = ExitCode.ERROR;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(message, fmt);
        process.exitCode = ExitCode.ERROR;
      }
    });
}
