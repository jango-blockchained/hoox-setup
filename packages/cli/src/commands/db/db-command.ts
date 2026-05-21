/**
 * `hoox db` command group — database management.
 *
 * Subcommands:
 *   apply [--remote] [--file <path>]   — Apply schema.sql to D1
 *   migrate [--remote]                  — Run tracking migrations
 *   list [--remote]                     — List database tables
 *   query <sql> [--remote]              — Execute a SQL query
 *   export [--output <path>]            — Export database
 *   reset [--confirm]                   — Drop and recreate (DESTRUCTIVE)
 */

import { Command } from "commander";
import * as p from "@clack/prompts";
import { DbService } from "../../services/db/index.js";
import {
  formatSuccess,
  formatTable,
  formatJson,
  getFormatOptions,
} from "../../utils/formatters.js";
import { withErrorHandling } from "../../utils/error-handler.js";
import type { FormatOptions } from "../../utils/formatters.js";

/**
 * Resolve database name from config or --database flag.
 */
async function resolveDb(cmd: Command, svc: DbService): Promise<string> {
  const opts = cmd.optsWithGlobals<{ database?: string }>();
  return await svc.resolveDbName(opts.database);
}

// ---------------------------------------------------------------------------
// db apply
// ---------------------------------------------------------------------------

async function handleApply(
  opts: FormatOptions,
  dbName: string,
  remote: boolean,
  file?: string
): Promise<void> {
  const svc = new DbService();
  const output = await svc.apply(dbName, remote, file);
  formatSuccess(
    `Schema applied to ${dbName}${remote ? " (remote)" : " (local)"}`,
    opts
  );
  if (!opts.quiet && output) {
    process.stdout.write(`${output}\n`);
  }
}

// ---------------------------------------------------------------------------
// db migrate
// ---------------------------------------------------------------------------

async function handleMigrate(
  opts: FormatOptions,
  dbName: string,
  remote: boolean
): Promise<void> {
  const svc = new DbService();
  const output = await svc.migrate(dbName, remote);
  formatSuccess(
    `Migrations applied to ${dbName}${remote ? " (remote)" : " (local)"}`,
    opts
  );
  if (!opts.quiet && output) {
    process.stdout.write(`${output}\n`);
  }
}

// ---------------------------------------------------------------------------
// db list
// ---------------------------------------------------------------------------

async function handleList(
  opts: FormatOptions,
  dbName: string,
  remote: boolean
): Promise<void> {
  const svc = new DbService();
  const tables = await svc.listTables(dbName, remote);

  if (opts.json) {
    formatJson(tables, opts);
  } else if (!opts.quiet) {
    if (tables.length === 0) {
      process.stdout.write("No tables found.\n");
      return;
    }
    const rows = tables.map((t) => ({ Table: t }));
    formatTable(rows, opts);
  }
}

// ---------------------------------------------------------------------------
// db query
// ---------------------------------------------------------------------------

async function handleQuery(
  opts: FormatOptions,
  dbName: string,
  sql: string,
  remote: boolean
): Promise<void> {
  const svc = new DbService();
  const output = await svc.query(dbName, sql, remote);

  if (opts.json) {
    // Already JSON from wrangler — try to parse for cleaner output
    try {
      const parsed = JSON.parse(output);
      formatJson(parsed, opts);
    } catch {
      process.stdout.write(`${output}\n`);
    }
  } else {
    process.stdout.write(`${output}\n`);
  }
}

// ---------------------------------------------------------------------------
// db export
// ---------------------------------------------------------------------------

async function handleExport(
  opts: FormatOptions,
  dbName: string,
  outputPath?: string
): Promise<void> {
  const svc = new DbService();
  const path = await svc.export(dbName, outputPath);
  formatSuccess(`Database exported to ${path}`, opts);
}

// ---------------------------------------------------------------------------
// db reset
// ---------------------------------------------------------------------------

async function handleReset(
  opts: FormatOptions,
  dbName: string,
  confirmed: boolean
): Promise<void> {
  if (!confirmed) {
    const answer = await p.confirm({
      message: `WARNING: This will DELETE and recreate the "${dbName}" database. ALL DATA WILL BE LOST. Continue?`,
      initialValue: false,
    });
    if (p.isCancel(answer) || !answer) {
      p.cancel("Reset cancelled.");
      return;
    }
  }

  const svc = new DbService();
  const output = await svc.reset(dbName);
  formatSuccess(`Database "${dbName}" has been recreated`, opts);
  if (!opts.quiet && output) {
    process.stdout.write(`${output}\n`);
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerDbCommand(program: Command): void {
  const dbCmd = program
    .command("db")
    .summary("Manage D1 databases")
    .description(
      `Manage Cloudflare D1 databases — schema, queries, migrations, backup.

SUBCOMMANDS:
  apply               Apply schema.sql to D1
  migrate             Run tracking migrations
  list                List database tables
  query <sql>         Execute a SQL query
  export              Export database to .sql file
  reset               Drop and recreate database (DESTRUCTIVE)

OPTIONS:
  --database <name>   Database name (auto-detected from config if omitted)
  --remote            Operate on production (remote) database

EXAMPLES:
  hoox db apply
  hoox db apply --remote
  hoox db migrate
  hoox db list
  hoox db query "SELECT * FROM trade_signals LIMIT 5"
  hoox db export
  hoox db reset`
    )
    .option("--database <name>", "Database name (auto-detected if omitted)")
    .option("--remote", "Operate on production (remote) database");

  // -- apply
  dbCmd
    .command("apply")
    .description("Apply schema.sql to the database")
    .option("--file <path>", "Path to schema.sql file")
    .action(
      withErrorHandling(
        async (options: { file?: string }, cmd: Command) => {
          const opts = getFormatOptions(cmd);
          const svc = new DbService();
          const dbName = await resolveDb(cmd, svc);
          const remote = Boolean(
            cmd.optsWithGlobals<{ remote?: boolean }>().remote
          );
          await handleApply(opts, dbName, remote, options.file);
        },
        { service: "db" }
      )
    );

  // -- migrate
  dbCmd
    .command("migrate")
    .description("Run tracking migrations")
    .action(
      withErrorHandling(
        async (_, cmd: Command) => {
          const opts = getFormatOptions(cmd);
          const svc = new DbService();
          const dbName = await resolveDb(cmd, svc);
          const remote = Boolean(
            cmd.optsWithGlobals<{ remote?: boolean }>().remote
          );
          await handleMigrate(opts, dbName, remote);
        },
        { service: "db" }
      )
    );

  // -- list
  dbCmd
    .command("list")
    .description("List database tables")
    .action(
      withErrorHandling(
        async (_, cmd: Command) => {
          const opts = getFormatOptions(cmd);
          const svc = new DbService();
          const dbName = await resolveDb(cmd, svc);
          const remote = Boolean(
            cmd.optsWithGlobals<{ remote?: boolean }>().remote
          );
          await handleList(opts, dbName, remote);
        },
        { service: "db" }
      )
    );

  // -- query
  dbCmd
    .command("query <sql>")
    .description("Execute a SQL query")
    .action(
      withErrorHandling(
        async (sql: string, _, cmd: Command) => {
          const opts = getFormatOptions(cmd);
          const svc = new DbService();
          const dbName = await resolveDb(cmd, svc);
          const remote = Boolean(
            cmd.optsWithGlobals<{ remote?: boolean }>().remote
          );
          await handleQuery(opts, dbName, sql, remote);
        },
        { service: "db" }
      )
    );

  // -- export
  dbCmd
    .command("export")
    .description("Export database to .sql file")
    .option("--output <path>", "Output file path")
    .action(
      withErrorHandling(
        async (options: { output?: string }, cmd: Command) => {
          const opts = getFormatOptions(cmd);
          const svc = new DbService();
          const dbName = await resolveDb(cmd, svc);
          await handleExport(opts, dbName, options.output);
        },
        { service: "db" }
      )
    );

  // -- reset
  dbCmd
    .command("reset")
    .description("Drop and recreate the database (DESTRUCTIVE)")
    .option("--confirm", "Skip confirmation prompt")
    .action(
      withErrorHandling(
        async (options: { confirm?: boolean }, cmd: Command) => {
          const opts = getFormatOptions(cmd);
          const svc = new DbService();
          const dbName = await resolveDb(cmd, svc);
          await handleReset(opts, dbName, Boolean(options.confirm));
        },
        { service: "db" }
      )
    );
}
