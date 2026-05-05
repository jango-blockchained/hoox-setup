import * as p from "@clack/prompts";
import ansis from "ansis";
import { parse as parseJsonc } from "jsonc-parser";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

/** Shape of a single worker entry in workers.jsonc */
interface WorkerConfig {
  enabled: boolean;
  path: string;
  vars?: Record<string, string>;
  secrets?: string[];
  [key: string]: unknown;
}

/** Parsed workers.jsonc structure */
interface WorkersConfig {
  global: {
    cloudflare_account_id: string;
    subdomain_prefix: string;
    [key: string]: unknown;
  };
  workers: Record<string, WorkerConfig>;
}

/** Per-worker setup result for the summary report */
interface WorkerSetupResult {
  worker: string;
  secretsBound: number;
  secretsSkipped: number;
  devVarsCreated: boolean;
  errors: string[];
}

export class WorkersSetupCommand implements Command {
  name = "workers:setup";
  description = "Bind secrets and provision environment";
  options = [
    {
      flag: "worker",
      short: "w",
      type: "string" as const,
      description: "Specific worker to setup",
    },
    {
      flag: "all",
      short: "a",
      type: "boolean" as const,
      description: "Setup all enabled workers",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: { worker: ctx.args?.worker, all: ctx.args?.all },
    });

    try {
      const specificWorker = ctx.args?.worker as string | undefined;
      const setupAll = (ctx.args?.all as boolean) || false;

      p.intro(ansis.bold("Worker Setup"));

      // 1. Read workers.jsonc
      const config = await this.readWorkersConfig(`${ctx.cwd}/workers.jsonc`);

      // 2. Determine which workers to process
      const workersToSetup = this.filterWorkers(
        config,
        specificWorker,
        setupAll
      );
      const workerNames = Object.keys(workersToSetup);

      if (workerNames.length === 0) {
        p.log.warn(ansis.yellow("No workers to set up."));
        p.outro(ansis.dim("Nothing to do."));
        ctx.observer.setState({ commandStatus: "success" });
        return;
      }

      p.log.info(
        ansis.dim(`Setting up ${workerNames.length} worker(s): `) +
          ansis.cyan(workerNames.join(", "))
      );

      // 3. Process each worker
      const results: WorkerSetupResult[] = [];
      const spinner = p.spinner();

      for (const workerName of workerNames) {
        const workerConfig = workersToSetup[workerName];
        const result: WorkerSetupResult = {
          worker: workerName,
          secretsBound: 0,
          secretsSkipped: 0,
          devVarsCreated: false,
          errors: [],
        };

        spinner.start(`Setting up ${ansis.cyan(workerName)}...`);

        // 3a. Verify wrangler.jsonc exists
        const wranglerPath = `${ctx.cwd}/${workerConfig.path}/wrangler.jsonc`;
        const wranglerExists = await Bun.file(wranglerPath).exists();
        if (!wranglerExists) {
          result.errors.push(`wrangler.jsonc not found at ${wranglerPath}`);
          spinner.stop(ansis.red(`✗ ${workerName}: wrangler.jsonc missing`));
          results.push(result);
          continue;
        }

        // 3b. Bind secrets
        const secrets = workerConfig.secrets || [];
        const devVarsEntries: string[] = [];

        for (const secretName of secrets) {
          try {
            // Prompt for the secret value
            const value = await ctx.adapters.bun.promptSecret(
              `Enter value for ${ansis.cyan(secretName)} (${workerName})`
            );

            if (!value || value.trim() === "") {
              result.secretsSkipped++;
              devVarsEntries.push(`${secretName}=""`);
              continue;
            }

            // Bind secret to Cloudflare via wrangler (piped via stdin)
            await ctx.adapters.cloudflare.setSecret(
              workerName,
              secretName,
              value
            );
            result.secretsBound++;
            devVarsEntries.push(`${secretName}="${value}"`);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(`Failed to set ${secretName}: ${msg}`);
            devVarsEntries.push(`${secretName}=""`);
          }
        }

        // 3c. Create .dev.vars for local development
        if (devVarsEntries.length > 0) {
          try {
            const devVarsPath = `${ctx.cwd}/${workerConfig.path}/.dev.vars`;
            await Bun.write(devVarsPath, devVarsEntries.join("\n") + "\n");
            result.devVarsCreated = true;
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(`Failed to write .dev.vars: ${msg}`);
          }
        }

        // Also write vars from config to .dev.vars if they exist
        if (workerConfig.vars && Object.keys(workerConfig.vars).length > 0) {
          try {
            const devVarsPath = `${ctx.cwd}/${workerConfig.path}/.dev.vars`;
            const varsEntries = Object.entries(workerConfig.vars).map(
              ([key, val]) => `${key}="${val}"`
            );
            // Prepend vars to existing .dev.vars or create new
            let existingContent = "";
            const devVarsFile = Bun.file(devVarsPath);
            if (await devVarsFile.exists()) {
              existingContent = await devVarsFile.text();
            }
            const fullContent = varsEntries.join("\n") + "\n" + existingContent;
            await Bun.write(devVarsPath, fullContent);
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            result.errors.push(`Failed to write vars to .dev.vars: ${msg}`);
          }
        }

        if (result.errors.length > 0) {
          spinner.stop(ansis.yellow(`⚠ ${workerName}: completed with errors`));
        } else {
          spinner.stop(ansis.green(`✓ ${workerName}: setup complete`));
        }

        results.push(result);
      }

      // 4. Show summary report
      this.printSummary(results);

      const hasErrors = results.some((r) => r.errors.length > 0);
      if (hasErrors) {
        ctx.observer.setState({ commandStatus: "error" });
      } else {
        ctx.observer.setState({ commandStatus: "success" });
      }

      p.outro(
        hasErrors
          ? ansis.yellow("Setup completed with some errors. See summary above.")
          : ansis.green("Environment provisioned successfully! 🎉")
      );
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Setup failed: ${error instanceof Error ? error.message : String(error)}`,
              "SETUP_FAILED",
              false
            );
      p.log.error(ansis.red(cliError.message));
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  /** Read and parse workers.jsonc */
  private async readWorkersConfig(path: string): Promise<WorkersConfig> {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new CLIError(
        `workers.jsonc not found at ${path}. Run: hoox config:init`,
        "CONFIG_NOT_FOUND",
        true
      );
    }
    const content = await file.text();
    const config = parseJsonc(content) as WorkersConfig;
    if (!config || !config.global || !config.workers) {
      throw new CLIError(
        "Invalid workers.jsonc: missing global or workers section",
        "CONFIG_INVALID",
        true
      );
    }
    return config;
  }

  /** Filter workers based on --worker and --all flags */
  private filterWorkers(
    config: WorkersConfig,
    specificWorker: string | undefined,
    setupAll: boolean
  ): Record<string, WorkerConfig> {
    // If --worker is specified, only that worker
    if (specificWorker) {
      const workerConfig = config.workers[specificWorker];
      if (!workerConfig) {
        throw new CLIError(
          `Worker "${specificWorker}" not found in workers.jsonc`,
          "WORKER_NOT_FOUND",
          true
        );
      }
      if (!workerConfig.enabled) {
        throw new CLIError(
          `Worker "${specificWorker}" is disabled in workers.jsonc`,
          "WORKER_DISABLED",
          true
        );
      }
      return { [specificWorker]: workerConfig };
    }

    // If --all or no flag, return all enabled workers
    const enabledWorkers: Record<string, WorkerConfig> = {};
    for (const [name, workerConfig] of Object.entries(config.workers)) {
      if (workerConfig.enabled) {
        enabledWorkers[name] = workerConfig;
      }
    }

    return enabledWorkers;
  }

  /** Print a summary report of the setup results */
  private printSummary(results: WorkerSetupResult[]): void {
    console.log("");
    console.log(ansis.bold("  Setup Summary"));
    console.log(ansis.dim("  ──────────────────────────────────────────────"));

    for (const result of results) {
      const icon =
        result.errors.length > 0 ? ansis.yellow("⚠") : ansis.green("✓");
      console.log(`  ${icon} ${ansis.bold(result.worker)}`);

      if (result.secretsBound > 0) {
        console.log(
          ansis.dim(`    Secrets bound: `) +
            ansis.green(`${result.secretsBound}`)
        );
      }
      if (result.secretsSkipped > 0) {
        console.log(
          ansis.dim(`    Secrets skipped: `) +
            ansis.yellow(`${result.secretsSkipped}`)
        );
      }
      if (result.devVarsCreated) {
        console.log(ansis.dim(`    .dev.vars: `) + ansis.green("created"));
      }
      for (const err of result.errors) {
        console.log(ansis.red(`    ✗ ${err}`));
      }
    }

    console.log(ansis.dim("  ──────────────────────────────────────────────"));
    console.log("");
  }
}
