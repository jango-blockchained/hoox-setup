// @ts-nocheck
/**
 * Unit tests for the monitor command.
 *
 * Stubs MonitorService, DbService, and KvSyncService prototypes to verify
 * the monitor command logic in isolation. Uses Commander's exitOverride to
 * suppress process exits during test runs.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { MonitorService } from "./monitor-service.js";
import { DbService } from "../../services/db/db-service.js";
import { KvSyncService } from "../../services/kv/kv-sync-service.js";

// Stub variables
let checkAllWorkerHealthMock: ReturnType<typeof mock>;
let resolveDbNameMock: ReturnType<typeof mock>;
let queryMock: ReturnType<typeof mock>;
let exportMock: ReturnType<typeof mock>;
let resolveNamespaceIdMock: ReturnType<typeof mock>;
let getMock: ReturnType<typeof mock>;
let setMock: ReturnType<typeof mock>;

// Preserve originals
const origCheckAll = MonitorService.prototype.checkAllWorkerHealth;
const origResolveDbName = DbService.prototype.resolveDbName;
const origQuery = DbService.prototype.query;
const origExport = DbService.prototype.export;
const origResolveNs = KvSyncService.prototype.resolveNamespaceId;
const origGet = KvSyncService.prototype.get;
const origSet = KvSyncService.prototype.set;

beforeEach(() => {
  mock.restore();
  process.exitCode = 0;

  // Restore originals
  (MonitorService.prototype as Record<string, unknown>).checkAllWorkerHealth =
    origCheckAll;
  (DbService.prototype as Record<string, unknown>).resolveDbName =
    origResolveDbName;
  (DbService.prototype as Record<string, unknown>).query = origQuery;
  (DbService.prototype as Record<string, unknown>).export = origExport;
  (KvSyncService.prototype as Record<string, unknown>).resolveNamespaceId =
    origResolveNs;
  (KvSyncService.prototype as Record<string, unknown>).get = origGet;
  (KvSyncService.prototype as Record<string, unknown>).set = origSet;

  // Fresh mocks
  checkAllWorkerHealthMock = mock(async () => ({
    workers: [
      { worker: "hoox", status: "healthy", statusCode: 200 },
      { worker: "trade-worker", status: "healthy", statusCode: 200 },
    ],
    healthyCount: 2,
    degradedCount: 0,
    unreachableCount: 0,
  }));

  resolveDbNameMock = mock(async () => "trade-data-db");
  queryMock = mock(
    async (_dbName: string, _sql: string, _remote: boolean) =>
      "[mock query result]"
  );
  exportMock = mock(async (_dbName: string) => "backup-2026-05-13.sql");
  resolveNamespaceIdMock = mock(async () => "ns-id-123");
  getMock = mock(async (_nsId: string, _key: string) => "false");
  setMock = mock(async (_nsId: string, _key: string, _value: string) => {});

  // Install mocks on prototypes
  (MonitorService.prototype as Record<string, unknown>).checkAllWorkerHealth =
    checkAllWorkerHealthMock;
  (DbService.prototype as Record<string, unknown>).resolveDbName =
    resolveDbNameMock;
  (DbService.prototype as Record<string, unknown>).query = queryMock;
  (DbService.prototype as Record<string, unknown>).export = exportMock;
  (KvSyncService.prototype as Record<string, unknown>).resolveNamespaceId =
    resolveNamespaceIdMock;
  (KvSyncService.prototype as Record<string, unknown>).get = getMock;
  (KvSyncService.prototype as Record<string, unknown>).set = setMock;
});

afterEach(() => {
  mock.restore();
  (MonitorService.prototype as Record<string, unknown>).checkAllWorkerHealth =
    origCheckAll;
  (DbService.prototype as Record<string, unknown>).resolveDbName =
    origResolveDbName;
  (DbService.prototype as Record<string, unknown>).query = origQuery;
  (DbService.prototype as Record<string, unknown>).export = origExport;
  (KvSyncService.prototype as Record<string, unknown>).resolveNamespaceId =
    origResolveNs;
  (KvSyncService.prototype as Record<string, unknown>).get = origGet;
  (KvSyncService.prototype as Record<string, unknown>).set = origSet;
});

async function importMonitorCommand(): Promise<{
  registerMonitorCommand: typeof import("./monitor-command.js").registerMonitorCommand;
}> {
  return import("./monitor-command.js");
}

async function createProgram(): Promise<Command> {
  const { registerMonitorCommand } = await importMonitorCommand();
  const program = new Command().name("hoox-test").exitOverride(() => {});
  registerMonitorCommand(program);
  return program;
}

describe("registerMonitorCommand", () => {
  // -- Command registration -------------------------------------------------

  it("registers 'monitor' as a command on the program", async () => {
    const program = await createProgram();
    const cmd = program.commands.find((c) => c.name() === "monitor");
    expect(cmd).toBeDefined();
  });

  it("registers 'monitor status' subcommand", async () => {
    const program = await createProgram();
    const monitorCmd = program.commands.find((c) => c.name() === "monitor")!;
    const statusCmd = monitorCmd.commands.find((c) => c.name() === "status");
    expect(statusCmd).toBeDefined();
  });

  it("registers 'monitor trades' subcommand with argument", async () => {
    const program = await createProgram();
    const monitorCmd = program.commands.find((c) => c.name() === "monitor")!;
    const tradesCmd = monitorCmd.commands.find((c) => c.name() === "trades");
    expect(tradesCmd).toBeDefined();
    const args = tradesCmd!.registeredArguments;
    expect(args.some((a) => a.name() === "limit")).toBe(true);
  });

  it("registers 'monitor logs' subcommand with optional argument", async () => {
    const program = await createProgram();
    const monitorCmd = program.commands.find((c) => c.name() === "monitor")!;
    const logsCmd = monitorCmd.commands.find((c) => c.name() === "logs");
    expect(logsCmd).toBeDefined();
  });

  it("registers 'monitor kill-switch' with show/on/off subcommands", async () => {
    const program = await createProgram();
    const monitorCmd = program.commands.find((c) => c.name() === "monitor")!;
    const ksCmd = monitorCmd.commands.find((c) => c.name() === "kill-switch");
    expect(ksCmd).toBeDefined();
    expect(ksCmd!.commands.find((c) => c.name() === "show")).toBeDefined();
    expect(ksCmd!.commands.find((c) => c.name() === "on")).toBeDefined();
    expect(ksCmd!.commands.find((c) => c.name() === "off")).toBeDefined();
  });

  it("registers 'monitor queue-depth' subcommand", async () => {
    const program = await createProgram();
    const monitorCmd = program.commands.find((c) => c.name() === "monitor")!;
    const qCmd = monitorCmd.commands.find((c) => c.name() === "queue-depth");
    expect(qCmd).toBeDefined();
  });

  it("registers 'monitor backup' subcommand", async () => {
    const program = await createProgram();
    const monitorCmd = program.commands.find((c) => c.name() === "monitor")!;
    const backupCmd = monitorCmd.commands.find((c) => c.name() === "backup");
    expect(backupCmd).toBeDefined();
  });

  // -- monitor status -------------------------------------------------------

  describe("monitor status", () => {
    it("calls checkAllWorkerHealth", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "status"], { from: "user" });
      expect(checkAllWorkerHealthMock).toHaveBeenCalled();
    });

    it("exits cleanly on success", async () => {
      process.exitCode = 0;
      const program = await createProgram();
      process.exitCode = 0;
      await program.parseAsync(["monitor", "status"], { from: "user" });
      expect(process.exitCode).toBe(0);
    });

    it("sets exitCode on service failure", async () => {
      checkAllWorkerHealthMock = mock(async () => {
        throw new Error("Connection failed");
      });
      (
        MonitorService.prototype as Record<string, unknown>
      ).checkAllWorkerHealth = checkAllWorkerHealthMock;

      const program = await createProgram();
      await program.parseAsync(["monitor", "status"], { from: "user" });
      expect(process.exitCode).toBe(1);
    });
  });

  // -- monitor trades -------------------------------------------------------

  describe("monitor trades", () => {
    it("calls db.query with trades table", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "trades"], { from: "user" });
      expect(resolveDbNameMock).toHaveBeenCalled();
      expect(queryMock).toHaveBeenCalled();
      const sql = queryMock.mock.calls[0][1] as string;
      expect(sql).toContain("trades");
      expect(sql).toContain("ORDER BY timestamp DESC");
    });

    it("accepts custom limit", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "trades", "25"], { from: "user" });
      const sql = queryMock.mock.calls[0][1] as string;
      expect(sql).toContain("LIMIT 25");
    });
  });

  // -- monitor kill-switch --------------------------------------------------

  describe("monitor kill-switch", () => {
    it("shows kill switch status", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "kill-switch", "show"], {
        from: "user",
      });
      expect(getMock).toHaveBeenCalledWith("ns-id-123", "trade:kill_switch");
    });

    it("turns kill switch on", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "kill-switch", "on"], {
        from: "user",
      });
      expect(setMock).toHaveBeenCalledWith(
        "ns-id-123",
        "trade:kill_switch",
        "true"
      );
    });

    it("turns kill switch off", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "kill-switch", "off"], {
        from: "user",
      });
      expect(setMock).toHaveBeenCalledWith(
        "ns-id-123",
        "trade:kill_switch",
        "false"
      );
    });
  });

  // -- monitor backup -------------------------------------------------------

  describe("monitor backup", () => {
    it("calls db.export", async () => {
      const program = await createProgram();
      await program.parseAsync(["monitor", "backup"], { from: "user" });
      expect(exportMock).toHaveBeenCalled();
    });
  });
});
