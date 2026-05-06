/**
 * `hoox infra` command group — Cloudflare infrastructure management.
 *
 * Subcommands:
 *   provision          — Auto-provision D1/KV/R2/Queues from wrangler.jsonc
 *   d1 [list|create|delete]   — D1 database management
 *   kv [list|create|delete]   — KV namespace management
 *   r2 [list|create|delete]   — R2 bucket management
 *   queues [list|create|delete] — Queue management
 *
 * All operations delegate to CloudflareService. Output respects --json / --quiet.
 */

import { Command } from "commander";
import { spinner } from "@clack/prompts";
import { parse } from "jsonc-parser";
import { resolve } from "node:path";
import { CloudflareService } from "../../services/cloudflare/index.js";
import { ConfigService } from "../../services/config/index.js";
import {
  formatTable,
  formatSuccess,
  formatError,
  formatJson,
} from "../../utils/formatters.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import { theme } from "../../utils/theme.js";
import type { InfraOptions, ProvisionItem, ProvisionResult } from "./types.js";
import type { WranglerResult } from "../../services/cloudflare/types.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract global options (--json, --quiet) from a commander Command. */
function getOptions(cmd: Command): InfraOptions {
  const opts = cmd.optsWithGlobals();
  return { json: opts.json, quiet: opts.quiet };
}

/**
 * Try to parse a wrangler JSON list output and display as a table.
 * Falls back to raw text output if parsing fails.
 */
function displayListResult(
  result: WranglerResult<string>,
  opts: InfraOptions,
  columns?: string[],
): void {
  if (!result.ok) {
    formatError(new CLIError(result.error, ExitCode.ERROR), opts);
    return;
  }

  const data = result.data;

  // Try JSON parse for structured output
  try {
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (opts.json) {
        formatJson(parsed, opts);
        return;
      }
      const rows = parsed.map((item: Record<string, unknown>) => {
        if (columns) {
          const row: Record<string, string> = {};
          for (const col of columns) {
            row[col] = String(item[col] ?? "");
          }
          return row;
        }
        // Show all top-level keys
        const row: Record<string, string> = {};
        for (const [k, v] of Object.entries(item)) {
          if (typeof v !== "object" || v === null) {
            row[k] = String(v);
          }
        }
        return row;
      });
      formatTable(rows, opts);
      return;
    }
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      if (opts.json) {
        formatJson(parsed, opts);
        return;
      }
    }
  } catch {
    // Not JSON — fall through to raw output
  }

  // Raw text output
  if (opts.json) {
    formatJson({ output: data }, opts);
  } else {
    process.stdout.write(data + "\n");
  }
}

/** Handle a create operation: run the service call, show success/error. */
async function handleCreate(
  name: string,
  label: string,
  fn: (name: string) => Promise<WranglerResult<string>>,
  opts: InfraOptions,
): Promise<void> {
  if (!opts.quiet) {
    process.stdout.write(`${theme.label(`Creating ${label}:`)} ${name}\n`);
  }

  const result = await fn(name);
  if (result.ok) {
    formatSuccess(`${label} "${name}" created`, opts);
  } else {
    formatError(new CLIError(result.error, ExitCode.ERROR), opts);
  }
}

/** Handle a delete operation: run the service call, show success/error. */
async function handleDelete(
  name: string,
  label: string,
  fn: (name: string) => Promise<WranglerResult<string>>,
  opts: InfraOptions,
): Promise<void> {
  if (!opts.quiet) {
    process.stdout.write(`${theme.label(`Deleting ${label}:`)} ${name}\n`);
  }

  const result = await fn(name);
  if (result.ok) {
    formatSuccess(`${label} "${name}" deleted`, opts);
  } else {
    formatError(new CLIError(result.error, ExitCode.ERROR), opts);
  }
}

// ---------------------------------------------------------------------------
// D1 handlers
// ---------------------------------------------------------------------------

async function doD1List(
  opts: InfraOptions,
  cf?: CloudflareService,
): Promise<void> {
  const cloudflare = cf ?? new CloudflareService();
  const result = await cloudflare.d1List();
  displayListResult(result, opts, ["name", "uuid", "version", "num_tables"]);
}

async function doD1Create(
  name: string,
  opts: InfraOptions,
  cf?: CloudflareService,
): Promise<void> {
  const cloudflare = cf ?? new CloudflareService();
  await handleCreate(name, "D1 database", (n) => cloudflare.d1Create(n), opts);
}

async function doD1Delete(
  name: string,
  opts: InfraOptions,
  cf?: CloudflareService,
): Promise<void> {
  const cloudflare = cf ?? new CloudflareService();
  await handleDelete(name, "D1 database", (n) => cloudflare.d1Delete(n), opts);
}

// ---------------------------------------------------------------------------
// KV handlers
// ---------------------------------------------------------------------------

async function doKvList(
  opts: InfraOptions,
  cf?: CloudflareService,
): Promise<void> {
  const cloudflare = cf ?? new CloudflareService();
  const result = await cloudflare.kvList();
  displayListResult(result, opts);
}

async function doKvCreate(
  name: string,
  opts: InfraOptions,
  cf?: CloudflareService,
): Promise<void> {
  const cloudflare = cf ?? new CloudflareService();
  await handleCreate(name, "KV namespace", (n) => cloudflare.kvCreate(n), opts);
}

async function doKvDelete(
  id: string,
  opts: InfraOptions,
  cf?: CloudflareService,
): Promise<void> {
  const cloudflare = cf ?? new CloudflareService();
  await handleDelete(id, "KV namespace", (n) => cloudflare.kvDelete(n), opts);
}

// ---------------------------------------------------------------------------
// R2 handlers
// ---------------------------------------------------------------------------

async function doR2List(
  opts: InfraOptions,
  cf?: CloudflareService,
): Promise<void> {
  const cloudflare = cf ?? new CloudflareService();
  const result = await cloudflare.r2List();
  displayListResult(result, opts);
}

async function doR2Create(
  name: string,
  opts: InfraOptions,
  cf?: CloudflareService,
): Promise<void> {
  const cloudflare = cf ?? new CloudflareService();
  await handleCreate(name, "R2 bucket", (n) => cloudflare.r2Create(n), opts);
}

async function doR2Delete(
  name: string,
  opts: InfraOptions,
  cf?: CloudflareService,
): Promise<void> {
  const cloudflare = cf ?? new CloudflareService();
  await handleDelete(name, "R2 bucket", (n) => cloudflare.r2Delete(n), opts);
}

// ---------------------------------------------------------------------------
// Queues handlers
// ---------------------------------------------------------------------------

async function doQueueList(
  opts: InfraOptions,
  cf?: CloudflareService,
): Promise<void> {
  const cloudflare = cf ?? new CloudflareService();
  const result = await cloudflare.queueList();
  displayListResult(result, opts);
}

async function doQueueCreate(
  name: string,
  opts: InfraOptions,
  cf?: CloudflareService,
): Promise<void> {
  const cloudflare = cf ?? new CloudflareService();
  await handleCreate(name, "Queue", (n) => cloudflare.queueCreate(n), opts);
}

async function doQueueDelete(
  name: string,
  opts: InfraOptions,
  cf?: CloudflareService,
): Promise<void> {
  const cloudflare = cf ?? new CloudflareService();
  await handleDelete(name, "Queue", (n) => cloudflare.queueDelete(n), opts);
}

// ---------------------------------------------------------------------------
// Provision handler
// ---------------------------------------------------------------------------

/**
 * Provision all infrastructure by scanning each enabled worker's wrangler.jsonc
 * for D1 databases, KV namespaces, R2 buckets, and Queue bindings, then
 * auto-creating any referenced resources via CloudflareService.
 */
async function doProvision(
  opts: InfraOptions,
  cf?: CloudflareService,
  config?: ConfigService,
): Promise<ProvisionResult> {
  const cloudflare = cf ?? new CloudflareService();
  const configService = config ?? new ConfigService();
  const items: ProvisionItem[] = [];
  let created = 0;
  let errors = 0;
  let exists = 0;

  try {
    await configService.load();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    formatError(new CLIError(message, ExitCode.ERROR), opts);
    return { items: [], summary: { total: 0, created: 0, errors: 0, exists: 0 } };
  }

  const enabledWorkers = configService.listEnabledWorkers();

  if (enabledWorkers.length === 0) {
    if (!opts.quiet) {
      process.stdout.write(theme.dim("No enabled workers found in workers.jsonc.\n"));
    }
    return { items: [], summary: { total: 0, created: 0, errors: 0, exists: 0 } };
  }

  const s = spinner();

  for (const workerName of enabledWorkers) {
    const workerConfig = configService.getWorker(workerName);
    if (!workerConfig?.path) continue;

    const wranglerPath = resolve(workerConfig.path, "wrangler.jsonc");
    const file = Bun.file(wranglerPath);

    if (!(await file.exists())) continue;

    let wranglerConfig: Record<string, unknown>;
    try {
      const content = await file.text();
      wranglerConfig = (parse(content) ?? {}) as Record<string, unknown>;
    } catch {
      // Skip workers with invalid wrangler.jsonc
      continue;
    }

    // -- D1 databases --
    const d1Databases = Array.isArray(wranglerConfig.d1_databases)
      ? (wranglerConfig.d1_databases as Array<Record<string, unknown>>)
      : [];
    for (const db of d1Databases) {
      const dbName = (db.database_name as string) ?? (db.binding as string);
      if (!dbName) continue;

      s.start(`Provisioning D1 database: ${dbName}`);
      const result = await cloudflare.d1Create(dbName);
      if (result.ok) {
        items.push({ name: dbName, type: "d1", status: "created" });
        created++;
        s.stop(`D1 database "${dbName}" created`);
      } else if (result.error.toLowerCase().includes("already exists")) {
        items.push({ name: dbName, type: "d1", status: "exists" });
        exists++;
        s.stop(`D1 database "${dbName}" already exists`);
      } else {
        items.push({ name: dbName, type: "d1", status: "error", error: result.error });
        errors++;
        s.stop(`D1 database "${dbName}" failed: ${result.error}`);
      }
    }

    // -- KV namespaces --
    const kvNamespaces = Array.isArray(wranglerConfig.kv_namespaces)
      ? (wranglerConfig.kv_namespaces as Array<Record<string, unknown>>)
      : [];
    for (const kv of kvNamespaces) {
      const kvBinding = (kv.binding as string) ?? `kv-${workerName}`;
      s.start(`Provisioning KV namespace: ${kvBinding}`);
      const result = await cloudflare.kvCreate(kvBinding);
      if (result.ok) {
        items.push({ name: kvBinding, type: "kv", status: "created" });
        created++;
        s.stop(`KV namespace "${kvBinding}" created`);
      } else if (result.error.toLowerCase().includes("already exists")) {
        items.push({ name: kvBinding, type: "kv", status: "exists" });
        exists++;
        s.stop(`KV namespace "${kvBinding}" already exists`);
      } else {
        items.push({ name: kvBinding, type: "kv", status: "error", error: result.error });
        errors++;
        s.stop(`KV namespace "${kvBinding}" failed: ${result.error}`);
      }
    }

    // -- R2 buckets --
    const r2Buckets = Array.isArray(wranglerConfig.r2_buckets)
      ? (wranglerConfig.r2_buckets as Array<Record<string, unknown>>)
      : [];
    for (const bucket of r2Buckets) {
      const bucketName = (bucket.bucket_name as string) ?? (bucket.binding as string);
      if (!bucketName) continue;

      s.start(`Provisioning R2 bucket: ${bucketName}`);
      const result = await cloudflare.r2Create(bucketName);
      if (result.ok) {
        items.push({ name: bucketName, type: "r2", status: "created" });
        created++;
        s.stop(`R2 bucket "${bucketName}" created`);
      } else if (result.error.toLowerCase().includes("already exists")) {
        items.push({ name: bucketName, type: "r2", status: "exists" });
        exists++;
        s.stop(`R2 bucket "${bucketName}" already exists`);
      } else {
        items.push({ name: bucketName, type: "r2", status: "error", error: result.error });
        errors++;
        s.stop(`R2 bucket "${bucketName}" failed: ${result.error}`);
      }
    }

    // -- Queues --
    let queueNames: string[] = [];
    if (wranglerConfig.queues && typeof wranglerConfig.queues === "object") {
      const queues = wranglerConfig.queues as Record<string, unknown>;
      const producers = Array.isArray(queues.producers)
        ? (queues.producers as Array<Record<string, unknown>>)
        : [];
      const consumers = Array.isArray(queues.consumers)
        ? (queues.consumers as Array<Record<string, unknown>>)
        : [];
      queueNames = [
        ...producers.map((q) => q.queue as string),
        ...consumers.map((q) => q.queue as string),
      ].filter(Boolean);
    }
    for (const qName of [...new Set(queueNames)]) {
      s.start(`Provisioning Queue: ${qName}`);
      const result = await cloudflare.queueCreate(qName);
      if (result.ok) {
        items.push({ name: qName, type: "queue", status: "created" });
        created++;
        s.stop(`Queue "${qName}" created`);
      } else if (result.error.toLowerCase().includes("already exists")) {
        items.push({ name: qName, type: "queue", status: "exists" });
        exists++;
        s.stop(`Queue "${qName}" already exists`);
      } else {
        items.push({ name: qName, type: "queue", status: "error", error: result.error });
        errors++;
        s.stop(`Queue "${qName}" failed: ${result.error}`);
      }
    }
  }

  const summary = { total: items.length, created, errors, exists };
  const result: ProvisionResult = { items, summary };

  // Show summary table
  if (!opts.quiet) {
    const summaryRows = [
      { Metric: "Total resources", Value: String(summary.total) },
      { Metric: "Created", Value: String(summary.created) },
      { Metric: "Already existed", Value: String(summary.exists) },
      { Metric: "Errors", Value: String(summary.errors) },
    ];
    if (opts.json) {
      formatJson(result, opts);
    } else {
      process.stdout.write("\n");
      formatTable(summaryRows, opts);
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Register the `hoox infra` command group on the given commander program.
 *
 * @example
 * ```ts
 * import { Command } from "commander";
 * import { registerInfraCommand } from "./commands/infra/index.js";
 * const program = new Command();
 * registerInfraCommand(program);
 * program.parse();
 * ```
 */
export function registerInfraCommand(program: Command): void {
  const infraCmd = program
    .command("infra")
    .description("Manage Cloudflare infrastructure (D1, KV, R2, Queues)");

  // -- provision ---------------------------------------------------------

  infraCmd
    .command("provision")
    .description("Auto-provision infrastructure from worker wrangler.jsonc files")
    .action(async function (this: Command) {
      const opts = getOptions(this);
      await doProvision(opts);
    });

  // -- d1 -----------------------------------------------------------------

  const d1Cmd = infraCmd.command("d1").description("Manage D1 databases");

  d1Cmd
    .command("list")
    .description("List all D1 databases")
    .action(async function (this: Command) {
      const opts = getOptions(this);
      await doD1List(opts);
    });

  d1Cmd
    .command("create <name>")
    .description("Create a D1 database")
    .action(async function (this: Command, name: string) {
      const opts = getOptions(this);
      await doD1Create(name, opts);
    });

  d1Cmd
    .command("delete <name>")
    .description("Delete a D1 database")
    .action(async function (this: Command, name: string) {
      const opts = getOptions(this);
      await doD1Delete(name, opts);
    });

  // -- kv -----------------------------------------------------------------

  const kvCmd = infraCmd.command("kv").description("Manage KV namespaces");

  kvCmd
    .command("list")
    .description("List all KV namespaces")
    .action(async function (this: Command) {
      const opts = getOptions(this);
      await doKvList(opts);
    });

  kvCmd
    .command("create <name>")
    .description("Create a KV namespace")
    .action(async function (this: Command, name: string) {
      const opts = getOptions(this);
      await doKvCreate(name, opts);
    });

  kvCmd
    .command("delete <id>")
    .description("Delete a KV namespace by ID")
    .action(async function (this: Command, id: string) {
      const opts = getOptions(this);
      await doKvDelete(id, opts);
    });

  // -- r2 -----------------------------------------------------------------

  const r2Cmd = infraCmd.command("r2").description("Manage R2 buckets");

  r2Cmd
    .command("list")
    .description("List all R2 buckets")
    .action(async function (this: Command) {
      const opts = getOptions(this);
      await doR2List(opts);
    });

  r2Cmd
    .command("create <name>")
    .description("Create an R2 bucket")
    .action(async function (this: Command, name: string) {
      const opts = getOptions(this);
      await doR2Create(name, opts);
    });

  r2Cmd
    .command("delete <name>")
    .description("Delete an R2 bucket")
    .action(async function (this: Command, name: string) {
      const opts = getOptions(this);
      await doR2Delete(name, opts);
    });

  // -- queues -------------------------------------------------------------

  const queuesCmd = infraCmd.command("queues").description("Manage Queues");

  queuesCmd
    .command("list")
    .description("List all Queues")
    .action(async function (this: Command) {
      const opts = getOptions(this);
      await doQueueList(opts);
    });

  queuesCmd
    .command("create <name>")
    .description("Create a Queue")
    .action(async function (this: Command, name: string) {
      const opts = getOptions(this);
      await doQueueCreate(name, opts);
    });

  queuesCmd
    .command("delete <name>")
    .description("Delete a Queue")
    .action(async function (this: Command, name: string) {
      const opts = getOptions(this);
      await doQueueDelete(name, opts);
    });
}

// ---------------------------------------------------------------------------
// Exports (for testing)
// ---------------------------------------------------------------------------

export {
  doD1List,
  doD1Create,
  doD1Delete,
  doKvList,
  doKvCreate,
  doKvDelete,
  doR2List,
  doR2Create,
  doR2Delete,
  doQueueList,
  doQueueCreate,
  doQueueDelete,
  doProvision,
  displayListResult,
  handleCreate,
  handleDelete,
};
