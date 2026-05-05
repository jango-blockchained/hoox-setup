import * as p from "@clack/prompts";
import ansis from "ansis";
import { parse, modify, applyEdits } from "jsonc-parser";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

/** Maps dashboard var keys to the worker name they reference */
const SERVICE_URL_MAP: Record<string, string> = {
  D1_WORKER_URL: "d1-worker",
  AGENT_SERVICE_URL: "agent-worker",
  TRADE_SERVICE_URL: "trade-worker",
  TELEGRAM_SERVICE_URL: "telegram-worker",
};

interface WorkersConfig {
  global: {
    cloudflare_account_id: string;
    subdomain_prefix: string;
    [key: string]: unknown;
  };
  workers: Record<
    string,
    {
      enabled: boolean;
      path: string;
      vars?: Record<string, string>;
      secrets?: string[];
      custom_domain?: string;
      [key: string]: unknown;
    }
  >;
}

interface DashboardWrangler {
  vars?: Record<string, string>;
  [key: string]: unknown;
}

export class WorkersUpdateInternalUrlsCommand implements Command {
  name = "workers:update-internal-urls";
  description = "Update dashboard wrangler.jsonc with worker service URLs";
  options = [
    {
      flag: "dry-run",
      short: "d",
      type: "boolean" as const,
      description: "Preview changes without writing",
    },
    {
      flag: "custom-domain",
      type: "string" as const,
      description: "Use custom domain for a worker (format: worker=domain)",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: {
        dryRun: ctx.args?.["dry-run"],
        customDomain: ctx.args?.["custom-domain"],
      },
    });

    try {
      p.intro(ansis.bold("Update Internal Worker URLs"));

      const dryRun = (ctx.args?.["dry-run"] as boolean) || false;
      const customDomainArg = ctx.args?.["custom-domain"] as string | undefined;

      // 1. Read workers.jsonc
      const workersConfigPath = `${ctx.cwd}/workers.jsonc`;
      const workersConfig = await this.readWorkersConfig(workersConfigPath);

      if (!workersConfig.global?.subdomain_prefix) {
        throw new CLIError(
          "Missing global.subdomain_prefix in workers.jsonc",
          "CONFIG_INVALID",
          true
        );
      }

      const subdomainPrefix = workersConfig.global.subdomain_prefix;
      p.log.info(ansis.dim(`Subdomain prefix: `) + ansis.cyan(subdomainPrefix));

      // 2. Parse custom domain overrides
      const customDomainOverrides = this.parseCustomDomainArg(customDomainArg);

      // 3. Build URL map
      const urlMap = this.buildUrlMap(
        subdomainPrefix,
        workersConfig,
        customDomainOverrides
      );

      // 4. Read dashboard wrangler.jsonc
      const dashboardWranglerPath = `${ctx.cwd}/pages/dashboard/wrangler.jsonc`;
      const wranglerContent = await this.readWranglerConfig(
        dashboardWranglerPath
      );
      const wrangler = parse(wranglerContent) as DashboardWrangler;

      // 5. Compute diff
      const changes = this.computeChanges(wrangler.vars ?? {}, urlMap);

      if (changes.length === 0) {
        p.log.success(ansis.green("All URLs are already up to date!"));
        ctx.observer.setState({ commandStatus: "success" });
        return;
      }

      // 6. Show diff
      this.showDiff(changes);

      if (dryRun) {
        p.log.info(ansis.yellow("Dry run — no changes written."));
        p.outro(ansis.dim("Run without --dry-run to apply changes."));
        ctx.observer.setState({ commandStatus: "success" });
        return;
      }

      // 7. Confirm
      const confirmed = await p.confirm({
        message: "Apply these changes to dashboard wrangler.jsonc?",
        initialValue: false,
      });

      if (p.isCancel(confirmed) || !confirmed) {
        p.cancel("Update cancelled.");
        return;
      }

      // 8. Apply changes
      await this.applyChanges(dashboardWranglerPath, wranglerContent, changes);

      p.outro(ansis.green("✓ Dashboard URLs updated successfully!"));
      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Update failed: ${error instanceof Error ? error.message : String(error)}`,
              "UPDATE_URLS_FAILED",
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
    const config = parse(content) as WorkersConfig;
    if (!config || !config.global || !config.workers) {
      throw new CLIError(
        "Invalid workers.jsonc: missing global or workers section",
        "CONFIG_INVALID",
        true
      );
    }
    return config;
  }

  /** Read dashboard wrangler.jsonc content */
  private async readWranglerConfig(path: string): Promise<string> {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new CLIError(
        `Dashboard wrangler.jsonc not found at ${path}`,
        "WRANGLER_NOT_FOUND",
        true
      );
    }
    return file.text();
  }

  /** Parse --custom-domain arg like "trade-worker=trade.example.com" */
  private parseCustomDomainArg(
    arg: string | undefined
  ): Record<string, string> {
    const overrides: Record<string, string> = {};
    if (!arg) return overrides;

    // Support comma-separated: "trade-worker=trade.example.com,agent-worker=agent.example.com"
    const parts = arg.split(",");
    for (const part of parts) {
      const [worker, domain] = part.split("=");
      if (worker && domain) {
        overrides[worker.trim()] = domain.trim();
      }
    }
    return overrides;
  }

  /** Build the URL map from config and overrides */
  private buildUrlMap(
    subdomainPrefix: string,
    config: WorkersConfig,
    customDomainOverrides: Record<string, string>
  ): Record<string, string> {
    const urlMap: Record<string, string> = {};

    for (const [varKey, workerName] of Object.entries(SERVICE_URL_MAP)) {
      const workerConfig = config.workers[workerName];

      // Check for custom domain override via CLI arg
      if (customDomainOverrides[workerName]) {
        urlMap[varKey] = `https://${customDomainOverrides[workerName]}`;
        continue;
      }

      // Check for custom_domain in workers.jsonc config
      if (workerConfig?.custom_domain) {
        urlMap[varKey] = `https://${workerConfig.custom_domain}`;
        continue;
      }

      // Default workers.dev URL
      urlMap[varKey] = `https://${workerName}.${subdomainPrefix}.workers.dev`;
    }

    return urlMap;
  }

  /** Compute changes between current vars and new URL map */
  private computeChanges(
    currentVars: Record<string, string>,
    urlMap: Record<string, string>
  ): Array<{ key: string; oldValue: string; newValue: string }> {
    const changes: Array<{ key: string; oldValue: string; newValue: string }> =
      [];

    for (const [key, newValue] of Object.entries(urlMap)) {
      const oldValue = currentVars[key];
      if (oldValue !== newValue) {
        changes.push({ key, oldValue: oldValue ?? "", newValue });
      }
    }

    return changes;
  }

  /** Show a colored diff of changes */
  private showDiff(
    changes: Array<{ key: string; oldValue: string; newValue: string }>
  ): void {
    console.log("");
    console.log(ansis.bold("  Changes to apply:"));
    console.log(ansis.dim("  ──────────────────────────────────────────────"));

    for (const change of changes) {
      if (change.oldValue) {
        console.log(
          ansis.dim(`  ${change.key}:`) +
            " " +
            ansis.red(`- ${change.oldValue}`)
        );
        console.log(
          ansis.dim(`  ${" ".repeat(change.key.length)}: `) +
            ansis.green(`+ ${change.newValue}`)
        );
      } else {
        console.log(
          ansis.dim(`  ${change.key}:`) +
            " " +
            ansis.green(`+ ${change.newValue}`) +
            ansis.dim(" (new)")
        );
      }
    }

    console.log(ansis.dim("  ──────────────────────────────────────────────"));
    console.log("");
  }

  /** Apply changes to the wrangler.jsonc file using jsonc-parser modify */
  private async applyChanges(
    filePath: string,
    content: string,
    changes: Array<{ key: string; newValue: string }>
  ): Promise<void> {
    let editedContent = content;

    for (const change of changes) {
      const edits = modify(
        editedContent,
        ["vars", change.key],
        change.newValue,
        {
          formattingOptions: { insertSpaces: true, tabSize: 2 },
        }
      );
      editedContent = applyEdits(editedContent, edits);
    }

    await Bun.write(filePath, editedContent);
  }
}
