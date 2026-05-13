import { Command } from "commander";
import { DbService } from "../../services/db/index.js";
import { MonitorService } from "./monitor-service.js";
import { KvSyncService } from "../../services/kv/kv-sync-service.js";
import {
  formatSuccess,
  formatError,
  formatTable,
} from "../../utils/formatters.js";
import type { FormatOptions } from "../../utils/formatters.js";
import { ExitCode } from "../../utils/errors.js";
import { theme } from "../../utils/theme.js";

function getFormatOptions(cmd: Command): FormatOptions {
  const opts = cmd.optsWithGlobals();
  return { json: Boolean(opts.json), quiet: Boolean(opts.quiet) };
}

async function doMonitorStatus(fmt: FormatOptions): Promise<void> {
  try {
    const monitor = new MonitorService();
    const result = await monitor.checkAllWorkerHealth();

    if (fmt.json) {
      process.stdout.write(JSON.stringify(result, null, 2) + "\n");
      return;
    }

    const rows = result.workers.map((w) => ({
      Worker: w.worker,
      Status: w.status,
      "Status Code": String(w.statusCode ?? "-"),
      Error: w.error ?? "-",
    }));
    formatTable(rows, fmt);

    process.stdout.write(
      `\n${theme.heading("Summary:")} ${result.healthyCount} healthy, ${result.degradedCount} degraded, ${result.unreachableCount} unreachable\n`
    );
  } catch (err) {
    formatError(err instanceof Error ? err.message : String(err), fmt);
    process.exitCode = ExitCode.ERROR;
  }
}

async function doMonitorTrades(
  limit: number,
  fmt: FormatOptions
): Promise<void> {
  try {
    const db = new DbService();
    const dbName = await db.resolveDbName();
    const sql = `SELECT * FROM trades ORDER BY timestamp DESC LIMIT ${Math.min(limit, 100)}`;
    const output = await db.query(dbName, sql, true);
    process.stdout.write(output + "\n");
  } catch (err) {
    formatError(err instanceof Error ? err.message : String(err), fmt);
    process.exitCode = ExitCode.ERROR;
  }
}

async function doMonitorLogs(
  workerName: string | undefined,
  fmt: FormatOptions
): Promise<void> {
  try {
    const db = new DbService();
    const dbName = await db.resolveDbName();
    let sql: string;
    if (workerName) {
      sql = `SELECT * FROM system_logs WHERE worker = '${workerName.replace(/'/g, "''")}' ORDER BY timestamp DESC LIMIT 20`;
    } else {
      sql = "SELECT * FROM system_logs ORDER BY timestamp DESC LIMIT 20";
    }
    const output = await db.query(dbName, sql, true);
    process.stdout.write(output + "\n");
  } catch (err) {
    formatError(err instanceof Error ? err.message : String(err), fmt);
    process.exitCode = ExitCode.ERROR;
  }
}

async function doMonitorKillSwitch(
  action: "show" | "on" | "off",
  fmt: FormatOptions
): Promise<void> {
  try {
    const kv = new KvSyncService();
    const namespaceId = await kv.resolveNamespaceId();
    const key = "trade:kill_switch";

    if (action === "show") {
      const value = await kv.get(namespaceId, key);
      const status =
        value === "true"
          ? "KILL SWITCH IS ON (trading halted)"
          : value === "false"
            ? "Kill switch is off (trading active)"
            : `Kill switch value: ${value ?? "(not set)"}`;
      process.stdout.write(`${theme.info(status)}\n`);
    } else {
      const newValue = action === "on" ? "true" : "false";
      await kv.set(namespaceId, key, newValue);
      formatSuccess(
        `Kill switch turned ${action === "on" ? "ON" : "OFF"}`,
        fmt
      );
    }
  } catch (err) {
    formatError(err instanceof Error ? err.message : String(err), fmt);
    process.exitCode = ExitCode.ERROR;
  }
}

async function doMonitorQueueDepth(fmt: FormatOptions): Promise<void> {
  try {
    const proc = Bun.spawn(["wrangler", "queues", "list"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      throw new Error(stderr.trim() || `wrangler exited with code ${exitCode}`);
    }

    process.stdout.write(stdout + "\n");
  } catch (err) {
    formatError(err instanceof Error ? err.message : String(err), fmt);
    process.exitCode = ExitCode.ERROR;
  }
}

async function doMonitorBackup(fmt: FormatOptions): Promise<void> {
  try {
    const db = new DbService();
    const dbName = await db.resolveDbName();
    const outputPath = await db.export(dbName);
    formatSuccess(`Database exported to ${outputPath}`, fmt);
  } catch (err) {
    formatError(err instanceof Error ? err.message : String(err), fmt);
    process.exitCode = ExitCode.ERROR;
  }
}

export function registerMonitorCommand(program: Command): void {
  const monitorCmd = program
    .command("monitor")
    .summary("Monitor and operate the trading system")
    .description(
      `Monitor worker health, trades, logs, and perform operational tasks.

SUBCOMMANDS:
  status          Check health of all workers
  trades [N]      Show N most recent trades (default: 10)
  logs [worker]   Show recent system logs from D1
  kill-switch     Emergency stop/resume trading
  queue-depth     List queues and pending messages
  backup          Export D1 database to timestamped .sql file

EXAMPLES:
  hoox monitor status             Check all workers health
  hoox monitor trades 20          Show 20 recent trades
  hoox monitor logs hoox          Show logs for hoox worker
  hoox monitor kill-switch show   Check kill switch status
  hoox monitor kill-switch on     Halt all trading
  hoox monitor kill-switch off    Resume trading
  hoox monitor queue-depth        Show queue info
  hoox monitor backup             Export D1 database`
    );

  monitorCmd
    .command("status")
    .summary("Check health of all workers")
    .description("Probe each worker's /health endpoint and report status.")
    .action(async function (this: Command) {
      const fmt = getFormatOptions(this);
      await doMonitorStatus(fmt);
    });

  monitorCmd
    .command("trades")
    .summary("Show recent trades from D1")
    .description("Query the trades table for the most recent entries.")
    .argument(
      "[limit]",
      "Number of trades to show (default: 10, max: 100)",
      "10"
    )
    .action(async function (this: Command, limit: string) {
      const fmt = getFormatOptions(this);
      await doMonitorTrades(parseInt(limit, 10) || 10, fmt);
    });

  monitorCmd
    .command("logs")
    .summary("Show recent system logs from D1")
    .description(
      "Query the system_logs table. Optionally filter by worker name."
    )
    .argument("[worker]", "Worker name to filter (optional)")
    .action(async function (this: Command, worker?: string) {
      const fmt = getFormatOptions(this);
      await doMonitorLogs(worker, fmt);
    });

  const ksCmd = monitorCmd
    .command("kill-switch")
    .summary("Emergency stop or resume trading")
    .description(
      `Control the trade:kill_switch KV key.

Commands:
  show   Display current kill switch status
  on     Halt all trading (set kill_switch=true)
  off    Resume trading (set kill_switch=false)`
    );

  ksCmd
    .command("show")
    .summary("Show kill switch status")
    .description("Display whether trading is halted or active.")
    .action(async function (this: Command) {
      const fmt = getFormatOptions(this);
      await doMonitorKillSwitch("show", fmt);
    });

  ksCmd
    .command("on")
    .summary("Halt all trading")
    .description(
      "Set trade:kill_switch=true to stop all trading operations. WARNING: This halts ALL trading activity immediately."
    )
    .action(async function (this: Command) {
      const fmt = getFormatOptions(this);
      await doMonitorKillSwitch("on", fmt);
    });

  ksCmd
    .command("off")
    .summary("Resume trading")
    .description(
      "Set trade:kill_switch=false to resume normal trading operations."
    )
    .action(async function (this: Command) {
      const fmt = getFormatOptions(this);
      await doMonitorKillSwitch("off", fmt);
    });

  monitorCmd
    .command("queue-depth")
    .summary("Show queue details")
    .description(
      "List queues via wrangler queues list to show configured queues."
    )
    .action(async function (this: Command) {
      const fmt = getFormatOptions(this);
      await doMonitorQueueDepth(fmt);
    });

  monitorCmd
    .command("backup")
    .summary("Export D1 database to .sql file")
    .description(
      "Export the D1 database to a timestamped .sql backup file via wrangler d1 export."
    )
    .action(async function (this: Command) {
      const fmt = getFormatOptions(this);
      await doMonitorBackup(fmt);
    });
}
