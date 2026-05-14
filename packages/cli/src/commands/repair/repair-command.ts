import { Command } from "commander";
import { RepairService } from "./repair-service.js";
import { CloudflareService } from "../../services/cloudflare/index.js";
import { DbService } from "../../services/db/index.js";
import { KvSyncService } from "../../services/kv/kv-sync-service.js";
import { SecretsService } from "../../services/secrets/index.js";
import {
  formatError,
  formatSuccess,
  type FormatOptions,
  getFormatOptions,
} from "../../utils/formatters.js";
import { CLIError, ExitCode } from "../../utils/errors.js";

async function handleCheck(fmt: FormatOptions): Promise<void> {
  try {
    const svc = new RepairService();
    const result = await svc.runSystemCheck();
    if (result.allPassed) {
      formatSuccess("All checks passed", fmt);
    } else {
      formatError(
        new CLIError(`${result.failedCount} check(s) failed`, ExitCode.ERROR),
        fmt
      );
      process.exitCode = ExitCode.ERROR;
    }
  } catch (err) {
    formatError(err instanceof Error ? err : String(err), fmt);
    process.exitCode = ExitCode.ERROR;
  }
}

async function handleWorker(name: string, fmt: FormatOptions): Promise<void> {
  try {
    const { ConfigService } = await import("../../services/config/index.js");
    const config = new ConfigService();
    await config.load();
    const workerConfig = config.getWorker(name);
    if (!workerConfig) {
      formatError(
        new CLIError(`Worker "${name}" not found`, ExitCode.ERROR),
        fmt
      );
      process.exitCode = ExitCode.ERROR;
      return;
    }
    const cf = new CloudflareService();
    const result = await cf.deploy(workerConfig.path);
    if (result.ok) {
      formatSuccess(`Worker "${name}" deployed — ${result.value.url}`, fmt);
    } else {
      formatError(
        new CLIError(
          `Failed to deploy "${name}": ${result.error}`,
          ExitCode.ERROR
        ),
        fmt
      );
      process.exitCode = ExitCode.ERROR;
    }
  } catch (err) {
    formatError(err instanceof Error ? err : String(err), fmt);
    process.exitCode = ExitCode.ERROR;
  }
}

async function handleInfra(fmt: FormatOptions): Promise<void> {
  try {
    const cf = new CloudflareService();
    const d1 = await cf.d1List();
    const kv = await cf.kvList();
    const r2 = await cf.r2List();
    const q = await cf.queueList();
    formatSuccess(
      `D1: ${d1.ok ? "ok" : "fail"}, KV: ${kv.ok ? "ok" : "fail"}, R2: ${r2.ok ? "ok" : "fail"}, Queues: ${q.ok ? "ok" : "fail"}`,
      fmt
    );
  } catch (err) {
    formatError(err instanceof Error ? err : String(err), fmt);
    process.exitCode = ExitCode.ERROR;
  }
}

async function handleSecrets(fmt: FormatOptions): Promise<void> {
  try {
    const secrets = await SecretsService.create();
    const allSecrets = secrets.listAllSecrets();
    let missing = 0;
    for (const name of Object.keys(allSecrets)) {
      const check = await secrets.checkLocalSecrets(name);
      missing += check.missing.length;
    }
    if (missing > 0) {
      formatError(
        new CLIError(`${missing} secret(s) missing`, ExitCode.ERROR),
        fmt
      );
      process.exitCode = ExitCode.ERROR;
    } else {
      formatSuccess("All secrets present", fmt);
    }
  } catch (err) {
    formatError(err instanceof Error ? err : String(err), fmt);
    process.exitCode = ExitCode.ERROR;
  }
}

async function handleKv(fmt: FormatOptions): Promise<void> {
  try {
    const kv = new KvSyncService();
    const nsId = await kv.resolveNamespaceId();
    formatSuccess(`KV namespace resolved: ${nsId}`, fmt);
  } catch (err) {
    formatError(err instanceof Error ? err : String(err), fmt);
    process.exitCode = ExitCode.ERROR;
  }
}

async function handleDb(fmt: FormatOptions): Promise<void> {
  try {
    const svc = new DbService();
    const dbName = await svc.resolveDbName();
    await svc.apply(dbName, false);
    formatSuccess(`DB "${dbName}" re-applied`, fmt);
  } catch (err) {
    formatError(err instanceof Error ? err : String(err), fmt);
    process.exitCode = ExitCode.ERROR;
  }
}

async function handleRebuild(fmt: FormatOptions): Promise<void> {
  try {
    const repair = new RepairService();
    await repair.runSystemCheck();
    const cf = new CloudflareService();
    const { ConfigService } = await import("../../services/config/index.js");
    const config = new ConfigService();
    await config.load();
    for (const worker of config.listEnabledWorkers()) {
      const cfg = config.getWorker(worker);
      if (cfg) {
        await cf.deploy(cfg.path);
      }
    }
    formatSuccess("Rebuild complete", fmt);
  } catch (err) {
    formatError(err instanceof Error ? err : String(err), fmt);
    process.exitCode = ExitCode.ERROR;
  }
}

export function registerRepairCommand(program: Command): void {
  const repairCmd = program
    .command("repair")
    .summary("Diagnose and repair the Hoox system")
    .description(
      "Run checks, deploy workers, or fix infrastructure, secrets, KV, and DB issues."
    );

  repairCmd
    .command("check")
    .description(
      "Run system diagnostics (workers, deps, types, infra, secrets)"
    )
    .action(async () => {
      const fmt = getFormatOptions(repairCmd);
      await handleCheck(fmt);
    });

  repairCmd
    .command("worker <name>")
    .description("Deploy a specific worker to fix it")
    .action(async (name: string) => {
      const fmt = getFormatOptions(repairCmd);
      await handleWorker(name, fmt);
    });

  repairCmd
    .command("infra")
    .description("Provision missing infrastructure (D1, KV, R2, Queues)")
    .action(async () => {
      const fmt = getFormatOptions(repairCmd);
      await handleInfra(fmt);
    });

  repairCmd
    .command("secrets")
    .description("Upload missing secrets to Cloudflare")
    .action(async () => {
      const fmt = getFormatOptions(repairCmd);
      await handleSecrets(fmt);
    });

  repairCmd
    .command("kv")
    .description("Re-sync KV namespace entries")
    .action(async () => {
      const fmt = getFormatOptions(repairCmd);
      await handleKv(fmt);
    });

  repairCmd
    .command("db")
    .description("Re-apply database schema")
    .action(async () => {
      const fmt = getFormatOptions(repairCmd);
      await handleDb(fmt);
    });

  repairCmd
    .command("rebuild")
    .description(
      "Full rebuild: check, deploy all workers, fix infra/secrets/db"
    )
    .action(async () => {
      const fmt = getFormatOptions(repairCmd);
      await handleRebuild(fmt);
    });
}
