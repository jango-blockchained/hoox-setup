/**
 * `hoox clone` command — clone worker repos as git submodules.
 *
 * Modes:
 *   hoox clone           — List workers with clone status (cloned / not cloned)
 *   hoox clone --all     — Clone all workers from workers.jsonc
 *   hoox clone <name>    — Clone a specific worker by name
 *
 * Repo URLs are derived from: https://github.com/<org>/<worker-name>.git
 * The org is auto-detected from `git remote get-url origin` or set via --org.
 *
 * Uses @clack/prompts spinner for progress feedback.
 */
import { Command } from "commander";
import { spinner } from "@clack/prompts";
import { ConfigService } from "../../services/config/index.js";
import { icons } from "../../utils/theme.js";
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

/** Per-worker clone status entry. */
interface CloneStatus {
  worker: string;
  path: string;
  cloned: boolean;
  repo?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract --json / --quiet from the global program options. */
function getFormatOptions(cmd: Command) {
  const opts = cmd.optsWithGlobals();
  return { json: Boolean(opts.json), quiet: Boolean(opts.quiet) };
}

/**
 * Resolve the base GitHub URL for worker repos.
 * Tries `git remote get-url origin` first, falls back to a sensible default.
 *
 * Examples:
 *   https://github.com/org/repo.git  →  https://github.com/org
 *   git@github.com:org/repo.git      →  https://github.com/org
 */
async function resolveRepoBase(): Promise<string> {
  try {
    const proc = Bun.spawn(["git", "remote", "get-url", "origin"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode === 0) {
      const url = (await new Response(proc.stdout).text()).trim();
      const match = url.match(/github\.com[:/]([^/]+)\/.+?(?:\.git)?$/);
      if (match) {
        return `https://github.com/${match[1]}`;
      }
    }
  } catch {
    // Fall through to default
  }
  return "https://github.com/jango-blockchained";
}

/** Build a repo URL from the org base and worker name. */
function getRepoUrl(orgBase: string, workerName: string): string {
  return `${orgBase}/${workerName}.git`;
}

/**
 * Check whether a worker is already cloned (has a `.git` entry).
 * For git submodules this is a file (not a directory) pointing to the
 * superproject's modules directory.
 */
async function isWorkerCloned(workerPath: string): Promise<boolean> {
  const dotGit = Bun.file(`${workerPath}/.git`);
  return dotGit.exists();
}

/**
 * Run `git submodule add <repo> <path>` to clone a single worker.
 * Returns a CloneStatus with the outcome.
 */
async function cloneWorker(
  repoUrl: string,
  targetPath: string,
  name: string,
  cwd: string
): Promise<CloneStatus> {
  const proc = Bun.spawn(["git", "submodule", "add", repoUrl, targetPath], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    return {
      worker: name,
      path: targetPath,
      cloned: false,
      repo: repoUrl,
      error:
        stderr.trim() || `git submodule add failed with exit code ${exitCode}`,
    };
  }

  return {
    worker: name,
    path: targetPath,
    cloned: true,
    repo: repoUrl,
  };
}

/** Run `git submodule update --init --recursive`. */
async function updateSubmodules(cwd: string): Promise<void> {
  const proc = Bun.spawn(
    ["git", "submodule", "update", "--init", "--recursive"],
    {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const exitCode = await proc.exited;

  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(
      stderr.trim() || `git submodule update failed with exit code ${exitCode}`
    );
  }
}

/**
 * Build the list of worker clone statuses, checking the filesystem for
 * whether each worker has already been cloned.
 */
async function buildStatusList(
  configService: ConfigService,
  repoBase: string
): Promise<CloneStatus[]> {
  const workers = configService.listWorkers();
  const statuses: CloneStatus[] = [];

  for (const name of workers) {
    const workerConfig = configService.getWorker(name);
    if (!workerConfig) continue;

    const cloned = await isWorkerCloned(workerConfig.path);
    statuses.push({
      worker: name,
      path: workerConfig.path,
      cloned,
      repo: getRepoUrl(repoBase, name),
    });
  }

  return statuses;
}

// ---------------------------------------------------------------------------
// Command registration
// ---------------------------------------------------------------------------

/**
 * Register the `hoox clone` command on the given commander program.
 *
 * @example
 * ```ts
 * import { registerCloneCommand } from "./commands/clone/index.js";
 * registerCloneCommand(program);
 * ```
 */
export function registerCloneCommand(program: Command): void {
  program
    .command("clone")
    .description("Clone worker repositories as git submodules")
    .option("--all", "Clone all worker repositories")
    .option(
      "--org <org>",
      "GitHub organization (derived from git remote by default)"
    )
    .argument("[name]", "Worker name to clone (omit to list status)")
    .action(
      async (
        name: string | undefined,
        options: { all?: boolean; org?: string }
      ) => {
        const fmt = getFormatOptions(program);

        try {
          const configService = new ConfigService();
          await configService.load();

          const workers = configService.listWorkers();

          // -------------------------------------------------------------------
          // Mode 1: No name, no --all  →  list clone status
          // -------------------------------------------------------------------
          if (!options.all && !name) {
            const repoBase = options.org
              ? `https://github.com/${options.org}`
              : await resolveRepoBase();

            const statuses = await buildStatusList(configService, repoBase);

            if (fmt.json) {
              formatJson(statuses, fmt);
              return;
            }

            if (fmt.quiet) {
              for (const s of statuses) {
                process.stdout.write(
                  `${s.worker}: ${s.cloned ? "cloned" : "not cloned"}\n`
                );
              }
              return;
            }

            const rows = statuses.map((s) => ({
              Worker: s.worker,
              Status: s.cloned ? "cloned" : "not cloned",
              Repo: s.repo ?? "-",
            }));
            formatTable(rows, fmt);
            return;
          }

          // -------------------------------------------------------------------
          // Mode 2: --all
          // -------------------------------------------------------------------
          if (options.all) {
            if (workers.length === 0) {
              formatSuccess("No workers defined in workers.jsonc", fmt);
              return;
            }

            const repoBase = options.org
              ? `https://github.com/${options.org}`
              : await resolveRepoBase();

            const s = spinner();
            s.start(`Cloning ${workers.length} worker(s)...`);

            const results: CloneStatus[] = [];

            for (let i = 0; i < workers.length; i++) {
              const name = workers[i];
              const workerConfig = configService.getWorker(name);
              if (!workerConfig) continue;

              // Skip already cloned workers
              const alreadyCloned = await isWorkerCloned(workerConfig.path);
              if (alreadyCloned) {
                s.message(
                  `[${i + 1}/${workers.length}] ${icons.info} ${name} already cloned — skipping`
                );
                results.push({
                  worker: name,
                  path: workerConfig.path,
                  cloned: true,
                  repo: getRepoUrl(repoBase, name),
                });
                continue;
              }

              s.message(`[${i + 1}/${workers.length}] Cloning ${name}...`);

              const result = await cloneWorker(
                getRepoUrl(repoBase, name),
                workerConfig.path,
                name,
                process.cwd()
              );
              results.push(result);

              if (result.cloned) {
                s.message(
                  `[${i + 1}/${workers.length}] ${icons.success} ${name} cloned`
                );
              } else {
                s.message(
                  `[${i + 1}/${workers.length}] ${icons.error} ${name} failed: ${result.error}`
                );
              }
            }

            // Run submodule update after all clones
            try {
              s.message("Updating submodules...");
              await updateSubmodules(process.cwd());
            } catch (updateErr) {
              const msg =
                updateErr instanceof Error
                  ? updateErr.message
                  : String(updateErr);
              s.message(`Warning: submodule update failed: ${msg}`);
            }

            const succeeded = results.filter((r) => r.cloned).length;
            const failed = results.filter((r) => !r.cloned).length;

            if (failed > 0) {
              s.stop(
                `Clone complete: ${succeeded} succeeded, ${failed} failed`
              );
              process.exitCode = ExitCode.ERROR;
            } else {
              s.stop(`All ${succeeded} worker(s) cloned successfully`);
            }

            // Print summary table (unless quiet)
            if (!fmt.quiet) {
              const rows = results.map((r) => ({
                Worker: r.worker,
                Status: r.cloned ? "cloned" : "failed",
                Repo: r.repo ?? "-",
              }));
              formatTable(rows, { json: fmt.json, quiet: false });
            }

            return;
          }

          // -------------------------------------------------------------------
          // Mode 3: <name>  —  clone a single worker
          // -------------------------------------------------------------------
          if (name) {
            const workerConfig = configService.getWorker(name);

            if (!workerConfig) {
              formatError(
                new CLIError(
                  `Worker "${name}" not found in workers.jsonc`,
                  ExitCode.ERROR
                ),
                fmt
              );
              process.exitCode = ExitCode.ERROR;
              return;
            }

            // Already cloned → early exit with success
            const alreadyCloned = await isWorkerCloned(workerConfig.path);
            if (alreadyCloned) {
              formatSuccess(
                `Worker "${name}" is already cloned at ${workerConfig.path}`,
                fmt
              );
              return;
            }

            const repoBase = options.org
              ? `https://github.com/${options.org}`
              : await resolveRepoBase();

            const s = spinner();
            s.start(`Cloning ${name}...`);

            const result = await cloneWorker(
              getRepoUrl(repoBase, name),
              workerConfig.path,
              name,
              process.cwd()
            );

            if (result.cloned) {
              // Update submodules after single clone too
              try {
                s.message("Updating submodules...");
                await updateSubmodules(process.cwd());
              } catch {
                // Non-fatal — the clone itself succeeded
              }

              s.stop(`Successfully cloned ${name}`);
              formatSuccess(`Cloned ${name} from ${result.repo}`, fmt);
            } else {
              s.stop(`Failed to clone ${name}`);
              formatError(
                new CLIError(
                  `Failed to clone "${name}": ${result.error}`,
                  ExitCode.ERROR
                ),
                fmt
              );
              process.exitCode = ExitCode.ERROR;
            }

            return;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          formatError(message, fmt);
          process.exitCode = ExitCode.ERROR;
        }
      }
    );
}
