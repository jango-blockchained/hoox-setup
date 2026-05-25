/**
 * Unit tests for the repair command.
 *
 * Stubs RepairService, CloudflareService, DbService, KvSyncService, and
 * SecretsService prototypes to verify repair command logic in isolation.
 * Uses Commander's exitOverride to suppress process exits during tests.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Command } from "commander";
import { RepairService } from "./repair-service.js";
import { CloudflareService } from "../../services/cloudflare/cloudflare-service.js";
import { DbService } from "../../services/db/db-service.js";
import { KvSyncService } from "../../services/kv/kv-sync-service.js";

// Stubs
let runSystemCheckMock: ReturnType<typeof mock>;
let deployMock: ReturnType<typeof mock>;

// Preserve originals
const origRunSystemCheck = RepairService.prototype.runSystemCheck;
const origDeploy = CloudflareService.prototype.deploy;
const origD1List = CloudflareService.prototype.d1List;
const origKvList = CloudflareService.prototype.kvList;
const origR2List = CloudflareService.prototype.r2List;
const origQueueList = CloudflareService.prototype.queueList;
const origResolveDbName = DbService.prototype.resolveDbName;
const origApply = DbService.prototype.apply;
const origMigrate = DbService.prototype.migrate;
const origExport = DbService.prototype.export;
const origReset = DbService.prototype.reset;
const origResolveNs = KvSyncService.prototype.resolveNamespaceId;
const origKvSet = KvSyncService.prototype.set;

beforeEach(() => {
  mock.restore();
  process.exitCode = 0;

  // Restore originals
  (
    RepairService.prototype as unknown as Record<string, unknown>
  ).runSystemCheck = origRunSystemCheck;
  (CloudflareService.prototype as unknown as Record<string, unknown>).deploy =
    origDeploy;
  (CloudflareService.prototype as unknown as Record<string, unknown>).d1List =
    origD1List;
  (CloudflareService.prototype as unknown as Record<string, unknown>).kvList =
    origKvList;
  (CloudflareService.prototype as unknown as Record<string, unknown>).r2List =
    origR2List;
  (
    CloudflareService.prototype as unknown as Record<string, unknown>
  ).queueList = origQueueList;
  (DbService.prototype as unknown as Record<string, unknown>).resolveDbName =
    origResolveDbName;
  (DbService.prototype as unknown as Record<string, unknown>).apply = origApply;
  (DbService.prototype as unknown as Record<string, unknown>).migrate =
    origMigrate;
  (DbService.prototype as unknown as Record<string, unknown>).export =
    origExport;
  (DbService.prototype as unknown as Record<string, unknown>).reset = origReset;
  (
    KvSyncService.prototype as unknown as Record<string, unknown>
  ).resolveNamespaceId = origResolveNs;
  (KvSyncService.prototype as unknown as Record<string, unknown>).set =
    origKvSet;

  // Fresh mocks
  runSystemCheckMock = mock(async () => ({
    steps: [
      { step: "Worker submodules", success: true, message: "All present" },
      { step: "Dependencies", success: true, message: "Installed" },
      { step: "TypeScript", success: true, message: "No errors" },
      { step: "Infrastructure", success: true, message: "All ok" },
      { step: "Secrets", success: true, message: "All present" },
    ],
    allPassed: true,
    passedCount: 5,
    failedCount: 0,
  }));

  deployMock = mock(async (_path: string, _env?: string) => ({
    ok: true as const,
    data: { url: "https://test-worker.cryptolinx.workers.dev" },
  }));

  (
    RepairService.prototype as unknown as Record<string, unknown>
  ).runSystemCheck = runSystemCheckMock;
  (CloudflareService.prototype as unknown as Record<string, unknown>).deploy =
    deployMock;
});

afterEach(() => {
  mock.restore();
  (
    RepairService.prototype as unknown as Record<string, unknown>
  ).runSystemCheck = origRunSystemCheck;
  (CloudflareService.prototype as unknown as Record<string, unknown>).deploy =
    origDeploy;
  (CloudflareService.prototype as unknown as Record<string, unknown>).d1List =
    origD1List;
  (CloudflareService.prototype as unknown as Record<string, unknown>).kvList =
    origKvList;
  (CloudflareService.prototype as unknown as Record<string, unknown>).r2List =
    origR2List;
  (
    CloudflareService.prototype as unknown as Record<string, unknown>
  ).queueList = origQueueList;
  (DbService.prototype as unknown as Record<string, unknown>).resolveDbName =
    origResolveDbName;
  (DbService.prototype as unknown as Record<string, unknown>).apply = origApply;
  (DbService.prototype as unknown as Record<string, unknown>).migrate =
    origMigrate;
  (DbService.prototype as unknown as Record<string, unknown>).export =
    origExport;
  (DbService.prototype as unknown as Record<string, unknown>).reset = origReset;
  (
    KvSyncService.prototype as unknown as Record<string, unknown>
  ).resolveNamespaceId = origResolveNs;
  (KvSyncService.prototype as unknown as Record<string, unknown>).set =
    origKvSet;
});

async function importRepairCommand(): Promise<{
  registerRepairCommand: typeof import("./repair-command.js").registerRepairCommand;
}> {
  return import("./repair-command.js");
}

async function createProgram(): Promise<Command> {
  const { registerRepairCommand } = await importRepairCommand();
  const program = new Command().name("hoox-test").exitOverride(() => {});
  registerRepairCommand(program);
  return program;
}

describe("registerRepairCommand", () => {
  // -- Command registration -------------------------------------------------

  it("registers 'repair' as a command on the program", async () => {
    const program = await createProgram();
    const cmd = program.commands.find((c) => c.name() === "repair");
    expect(cmd).toBeDefined();
  });

  it("registers 'repair check' subcommand", async () => {
    const program = await createProgram();
    const repairCmd = program.commands.find((c) => c.name() === "repair")!;
    expect(repairCmd.commands.find((c) => c.name() === "check")).toBeDefined();
  });

  it("registers 'repair worker <name>' with argument", async () => {
    const program = await createProgram();
    const repairCmd = program.commands.find((c) => c.name() === "repair")!;
    const workerCmd = repairCmd.commands.find((c) => c.name() === "worker");
    expect(workerCmd).toBeDefined();
    expect(
      workerCmd!.registeredArguments.some((a) => a.name() === "name")
    ).toBe(true);
  });

  it("registers 'repair infra' subcommand", async () => {
    const program = await createProgram();
    const repairCmd = program.commands.find((c) => c.name() === "repair")!;
    expect(repairCmd.commands.find((c) => c.name() === "infra")).toBeDefined();
  });

  it("registers 'repair secrets' subcommand", async () => {
    const program = await createProgram();
    const repairCmd = program.commands.find((c) => c.name() === "repair")!;
    expect(
      repairCmd.commands.find((c) => c.name() === "secrets")
    ).toBeDefined();
  });

  it("registers 'repair kv' subcommand", async () => {
    const program = await createProgram();
    const repairCmd = program.commands.find((c) => c.name() === "repair")!;
    expect(repairCmd.commands.find((c) => c.name() === "kv")).toBeDefined();
  });

  it("registers 'repair db' subcommand", async () => {
    const program = await createProgram();
    const repairCmd = program.commands.find((c) => c.name() === "repair")!;
    expect(repairCmd.commands.find((c) => c.name() === "db")).toBeDefined();
  });

  it("registers 'repair rebuild' subcommand", async () => {
    const program = await createProgram();
    const repairCmd = program.commands.find((c) => c.name() === "repair")!;
    expect(
      repairCmd.commands.find((c) => c.name() === "rebuild")
    ).toBeDefined();
  });

  // -- repair check ---------------------------------------------------------

  describe("repair check", () => {
    it("calls runSystemCheck", async () => {
      const program = await createProgram();
      await program.parseAsync(["repair", "check"], { from: "user" });
      expect(runSystemCheckMock).toHaveBeenCalled();
    });

    it("exits cleanly on all passed", async () => {
      const program = await createProgram();
      await program.parseAsync(["repair", "check"], { from: "user" });
      expect(process.exitCode).toBe(0);
    });

    it("sets exitCode on failure", async () => {
      runSystemCheckMock = mock(async () => {
        throw new Error("Check failed");
      });
      (
        RepairService.prototype as unknown as Record<string, unknown>
      ).runSystemCheck = runSystemCheckMock;

      const program = await createProgram();
      await program.parseAsync(["repair", "check"], { from: "user" });
      expect(process.exitCode).toBe(1);
    });
  });

  // -- repair worker <name> --------------------------------------------------

  describe("repair worker <name>", () => {
    it("calls deploy for the specified worker", async () => {
      const program = await createProgram();
      await program.parseAsync(["repair", "worker", "hoox"], { from: "user" });
      expect(deployMock).toHaveBeenCalled();
    });

    it("handles unknown worker name", async () => {
      // Mock getWorker to return undefined
      const program = await createProgram();
      await program.parseAsync(["repair", "worker", "nonexistent"], {
        from: "user",
      });
      expect(process.exitCode).toBe(1);
    });
  });
});
