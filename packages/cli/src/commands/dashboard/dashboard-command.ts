import type { Command } from "commander";
import { ConfigService } from "../../services/config/index.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import { formatSuccess, formatTable } from "../../utils/formatters.js";
import { withErrorHandling } from "../../utils/error-handler.js";
import type { FormatOptions } from "../../utils/formatters.js";
import { theme, icons } from "../../utils/theme.js";
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
    console.log(theme.heading("\nService URL changes:"));
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
    .description("Dashboard-specific operations");

  dashboardCmd
    .command("update-urls")
    .description("Update dashboard wrangler.jsonc with current service URLs")
    .option("--dry-run", "Show changes without applying")
    .action(
      withErrorHandling(
        async (options: { dryRun?: boolean }) => {
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
