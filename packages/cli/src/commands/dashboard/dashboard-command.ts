import type { Command } from "commander";
import { ConfigService } from "../../services/config/index.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import { formatSuccess, formatTable } from "../../utils/formatters.js";
import { withErrorHandling } from "../../utils/error-handler.js";
import type { FormatOptions } from "../../utils/formatters.js";
import { theme } from "../../utils/theme.js";
import * as jsonc from "jsonc-parser";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

interface ServiceUrl {
  worker: string;
  url: string;
}

function getServiceUrls(config: ConfigService): ServiceUrl[] {
  const global = config.getGlobal();
  const prefix = global.subdomain_prefix ?? "hoox";
  const workers = config.listEnabledWorkers();

  return workers.map((name) => ({
    worker: name,
    url: `https://${name}.${prefix}.workers.dev`,
  }));
}

function updateWranglerVars(
  filePath: string,
  urls: ServiceUrl[],
  dryRun: boolean,
  opts: FormatOptions
): void {
  if (!existsSync(filePath)) {
    throw new CLIError(
      `Dashboard wrangler.jsonc not found at ${filePath}`,
      ExitCode.ERROR
    );
  }

  const content = readFileSync(filePath, "utf-8");
  const errors: jsonc.ParseError[] = [];
  const parsed = jsonc.parse(content, errors) as Record<string, unknown>;

  if (errors.length > 0) {
    throw new CLIError(`Invalid JSONC in ${filePath}`, ExitCode.ERROR);
  }

  const vars = (parsed.vars as Record<string, string>) ?? {};
  const changes: { key: string; oldValue: string; newValue: string }[] = [];

  for (const { worker, url } of urls) {
    const key = `${worker.toUpperCase().replace(/-/g, "_")}_URL`;
    const oldValue = vars[key] ?? "(not set)";
    changes.push({ key, oldValue, newValue: url });
    vars[key] = url;
  }

  if (changes.length === 0) {
    formatSuccess("No service URLs to update.", opts);
    return;
  }

  if (!opts.quiet) {
    const rows = changes.map((c) => ({
      Key: c.key,
      Old: c.oldValue,
      New: theme.success(c.newValue),
    }));
    process.stdout.write(theme.heading("\nService URL changes:") + "\n");
    formatTable(rows, opts);
  }

  if (dryRun) {
    formatSuccess("Dry run — no changes written.", opts);
    return;
  }

  const fresh = readFileSync(filePath, "utf-8");
  const edits = jsonc.modify(fresh, ["vars"], vars, {
    formattingOptions: { tabSize: 2, insertSpaces: true },
  });
  const updated = jsonc.applyEdits(fresh, edits);
  writeFileSync(filePath, updated, "utf-8");

  formatSuccess(
    `Updated ${changes.length} service URL(s) in dashboard wrangler.jsonc`,
    opts
  );
}

export function registerDashboardCommand(program: Command): void {
  const dashboardCmd = program
    .command("dashboard")
    .summary(
      "Dashboard operations (alias for 'deploy dashboard' / 'dev dashboard')"
    )
    .description(
      `Dashboard operations. This is a top-level alias that unifies the
dashboard-related commands that are scattered across the CLI:

  hoox dashboard dev          →  hoox dev dashboard
  hoox dashboard deploy       →  hoox deploy dashboard
  hoox dashboard update-urls  →  hoox deploy update-internal-urls (DEPRECATED)

Use whichever is more convenient — both work identically.

EXAMPLES:
  hoox dashboard dev                      Start dashboard dev server
  hoox dashboard deploy                   Build and deploy the dashboard
  hoox dashboard deploy --rebuild         Force rebuild before deploy
`
    );

  // -- dashboard dev ------------------------------------------------------
  // Top-level alias for `hoox dev dashboard`

  dashboardCmd
    .command("dev")
    .description(
      "Start the dashboard dev server (alias for 'hoox dev dashboard')"
    )
    .action(
      withErrorHandling(
        async () => {
          const proc = Bun.spawn(["hoox", "dev", "dashboard"], {
            stdio: ["inherit", "inherit", "inherit"],
          });
          process.exitCode = await proc.exited;
        },
        { service: "dashboard" }
      )
    );

  // -- dashboard deploy ---------------------------------------------------
  // Top-level alias for `hoox deploy dashboard`

  dashboardCmd
    .command("deploy")
    .description(
      "Build and deploy the dashboard (alias for 'hoox deploy dashboard')"
    )
    .option("--rebuild", "Force rebuild before deploying")
    .option(
      "--auto",
      "Skip dashboard rebuild prompt, use existing build if available"
    )
    .action(
      withErrorHandling(
        async (options: { rebuild?: boolean; auto?: boolean }) => {
          const args = ["hoox", "deploy", "dashboard"];
          if (options.rebuild) args.push("--rebuild");
          if (options.auto) args.push("--auto");
          const proc = Bun.spawn(args, {
            stdio: ["inherit", "inherit", "inherit"],
          });
          process.exitCode = await proc.exited;
        },
        { service: "dashboard" }
      )
    );

  // -- dashboard update-urls (DEPRECATED) ---------------------------------

  dashboardCmd
    .command("update-urls")
    .description(
      "Update dashboard wrangler.jsonc with current service URLs (DEPRECATED)"
    )
    .option("--dry-run", "Show changes without applying")
    .action(
      withErrorHandling(
        async (options: { dryRun?: boolean }) => {
          process.stdout.write(
            theme.warning(
              "! This command is deprecated. Use `hoox deploy update-internal-urls` instead.\n"
            )
          );

          const opts: FormatOptions = {
            json: program.opts<{ json?: boolean }>().json,
            quiet: program.opts<{ quiet?: boolean }>().quiet,
          };

          const config = new ConfigService();
          await config.load();

          const urls = getServiceUrls(config);
          const dashboardPath = resolve(
            process.cwd(),
            "pages",
            "dashboard",
            "wrangler.jsonc"
          );

          updateWranglerVars(
            dashboardPath,
            urls,
            options.dryRun === true,
            opts
          );
        },
        { service: "dashboard" }
      )
    );
}
