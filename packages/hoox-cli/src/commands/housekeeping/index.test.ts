import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { CommandContext, Observer, CloudflareAdapter } from "../../core/types.js";

// ── Mock factories ─────────────────────────────────────────────────────

function createMockCloudflare(
  overrides: Record<string, unknown> = {}
): CloudflareAdapter {
  return {
    deployWorker: mock(async () => {}),
    testConnection: mock(async () => true),
    getWorkerHealth: mock(async (name: string) => ({
      name,
      status: "healthy" as const,
    })),
    listD1Databases: mock(async () => [
      { uuid: "test-uuid", name: "my-database", title: "My Database" },
    ]),
    createD1Database: mock(async () => ({
      uuid: "test-uuid",
      name: "test-db",
      title: "Test DB",
    })),
    deleteD1Database: mock(async () => {}),
    executeD1Query: mock(async () => ({
      results: [{ health_check: 1 }],
    })),
    listKVNamespaces: mock(async () => [
      { id: "ns-config-kv", title: "CONFIG_KV" },
    ]),
    createKVNamespace: mock(async () => ({
      id: "ns-new",
      title: "NEW_KV",
    })),
    deleteKVNamespace: mock(async () => {}),
    getKVValue: mock(async () => null),
    putKVValue: mock(async () => {}),
    listR2Buckets: mock(async () => []),
    createR2Bucket: mock(async () => ({ name: "test-bucket" })),
    deleteR2Bucket: mock(async () => {}),
    listQueues: mock(async () => [
      { queue_name: "trade-queue" },
      { queue_name: "signal-queue" },
    ]),
    createQueue: mock(async () => ({ queue_name: "test-queue" })),
    deleteQueue: mock(async () => {}),
    listSecrets: mock(async () => []),
    getSecret: mock(async () => ({
      name: "test-secret",
      created: "2024-01-01",
      version: 1,
    })),
    setSecret: mock(async () => {}),
    deleteSecret: mock(async () => {}),
    listZones: mock(async () => []),
    listDNSRecords: mock(async () => []),
    addDNSRecord: mock(async () => ({ id: "test-record" })),
    deleteDNSRecord: mock(async () => {}),
    ...overrides,
  } as unknown as CloudflareAdapter;
}

function createMockContext(
  overrides: {
    args?: Record<string, unknown>;
    cloudflare?: Record<string, unknown>;
    cwd?: string;
  } = {}
): CommandContext {
  return {
    observer: {
      emit: mock(() => {}),
      getState: mock(() => ({
        workers: {},
        commandStatus: "idle",
      })),
      setState: mock(() => {}),
      subscribe: mock(() => () => {}),
      on: mock(() => () => {}),
    } as unknown as Observer,
    engine: {} as any,
    adapters: {
      cloudflare: createMockCloudflare(overrides.cloudflare || {}),
      bun: {} as any,
      workers: {} as any,
    },
    cwd: overrides.cwd || "/test",
    args: overrides.args,
  };
}

/** Mock Bun.file to return a valid workers.jsonc. */
function mockBunFile(workersConfig?: Record<string, unknown>) {
  const originalBunFile = Bun.file;
  const defaultConfig = {
    global: {
      cloudflare_account_id: "test-account-id",
      subdomain_prefix: "test",
    },
    workers: {
      hoox: { enabled: true, path: "workers/hoox" },
      "d1-worker": {
        enabled: true,
        path: "workers/d1-worker",
        vars: { database_name: "my-database" },
      },
      "trade-worker": { enabled: true, path: "workers/trade-worker" },
    },
    ...workersConfig,
  };

  (Bun as any).file = mock((path: string) => {
    if (path.endsWith("workers.jsonc")) {
      return {
        exists: mock(async () => true),
        text: mock(async () => JSON.stringify(defaultConfig)),
      };
    }
    return { exists: mock(async () => false) };
  });

  return originalBunFile;
}

function restoreBunFile(original: typeof Bun.file) {
  (Bun as any).file = original;
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("HousekeepingCommand", () => {
  let HousekeepingCommand: new () => {
    name: string;
    description: string;
    options: Array<{
      flag: string;
      short?: string;
      type: string;
      description?: string;
    }>;
    execute: (ctx: CommandContext) => Promise<void>;
  };

  beforeEach(async () => {
    const module = await import("./index.js");
    HousekeepingCommand = module.default;
  });

  it("should have correct name and description", () => {
    const cmd = new HousekeepingCommand();
    expect(cmd.name).toBe("housekeeping");
    expect(cmd.description).toBeDefined();
    expect(cmd.description.length).toBeGreaterThan(0);
  });

  it("should have --fix and --json options", () => {
    const cmd = new HousekeepingCommand();
    expect(cmd.options).toBeDefined();

    const fixOption = cmd.options!.find((o) => o.flag === "fix");
    expect(fixOption).toBeDefined();
    expect(fixOption!.type).toBe("boolean");
    expect(fixOption!.short).toBe("f");

    const jsonOption = cmd.options!.find((o) => o.flag === "json");
    expect(jsonOption).toBeDefined();
    expect(jsonOption!.type).toBe("boolean");
    expect(jsonOption!.short).toBe("j");
  });

  it("should emit command:start on execute", async () => {
    const cmd = new HousekeepingCommand();
    const mockCtx = createMockContext();
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw CLIError on check failure — expected
    }

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "housekeeping" })
    );

    restoreBunFile(originalBunFile);
  });

  it("should set commandStatus to success when all checks pass", async () => {
    const cmd = new HousekeepingCommand();
    const mockCtx = createMockContext();
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw on failure
    }

    const stateCalls = (mockCtx.observer.setState as any).mock.calls;
    const successCall = stateCalls.find(
      (call: any[]) => call[0]?.commandStatus === "success"
    );
    expect(successCall).toBeDefined();

    restoreBunFile(originalBunFile);
  });

  it("should set commandStatus to error when critical checks fail", async () => {
    const cmd = new HousekeepingCommand();
    // Make all worker health checks return "down"
    const mockCtx = createMockContext({
      cloudflare: {
        getWorkerHealth: mock(async (name: string) => ({
          name,
          status: "down",
        })),
        executeD1Query: mock(async () => {
          throw new Error("Database unreachable");
        }),
      },
    });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // Expected to throw CLIError
    }

    const stateCalls = (mockCtx.observer.setState as any).mock.calls;
    const errorCall = stateCalls.find(
      (call: any[]) => call[0]?.commandStatus === "error"
    );
    expect(errorCall).toBeDefined();

    restoreBunFile(originalBunFile);
  });

  it("should output JSON when --json flag is set", async () => {
    const cmd = new HousekeepingCommand();
    const logSpy = mock((..._args: unknown[]) => {});
    const originalLog = console.log;
    console.log = logSpy;

    const mockCtx = createMockContext({ args: { json: true } });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw on failure
    }

    // Find the JSON output call
    const jsonCalls = logSpy.mock.calls.filter((call: any[]) => {
      try {
        const parsed = JSON.parse(call[0]);
        return parsed.timestamp !== undefined && parsed.overall !== undefined;
      } catch {
        return false;
      }
    });

    expect(jsonCalls.length).toBeGreaterThan(0);

    const report = JSON.parse(jsonCalls[0][0] as string);
    expect(report).toHaveProperty("timestamp");
    expect(report).toHaveProperty("overall");
    expect(report).toHaveProperty("checks");
    expect(report).toHaveProperty("recommendations");
    expect(report.checks).toHaveProperty("workers");
    expect(report.checks).toHaveProperty("database");
    expect(report.checks).toHaveProperty("kv");
    expect(report.checks).toHaveProperty("queues");
    expect(report.checks).toHaveProperty("logs");

    console.log = originalLog;
    restoreBunFile(originalBunFile);
  });

  it("should check worker health for all enabled workers", async () => {
    const getWorkerHealthMock = mock(async (name: string) => ({
      name,
      status: "healthy" as const,
    }));

    const cmd = new HousekeepingCommand();
    const mockCtx = createMockContext({
      cloudflare: { getWorkerHealth: getWorkerHealthMock },
    });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw
    }

    // Should have called getWorkerHealth for each enabled worker
    expect(getWorkerHealthMock.mock.calls.length).toBeGreaterThan(0);

    restoreBunFile(originalBunFile);
  });

  it("should check database connectivity via D1 query", async () => {
    const executeD1QueryMock = mock(async () => ({
      results: [{ health_check: 1 }],
    }));

    const cmd = new HousekeepingCommand();
    const mockCtx = createMockContext({
      cloudflare: { executeD1Query: executeD1QueryMock },
    });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw
    }

    // Should have called executeD1Query for health check
    const calls = executeD1QueryMock.mock.calls;
    const healthCheckCall = calls.find(
      (call: any[]) => call[1]?.includes("SELECT 1")
    );
    expect(healthCheckCall).toBeDefined();

    restoreBunFile(originalBunFile);
  });

  it("should check KV accessibility with read/write test", async () => {
    const putKVValueMock = mock(async () => {});
    const getKVValueMock = mock(async (_nsId: string, key: string) => {
      if (key === "__housekeeping_health_check__") {
        return `housekeeping-check-${Date.now()}`;
      }
      return null;
    });

    const cmd = new HousekeepingCommand();
    const mockCtx = createMockContext({
      cloudflare: {
        putKVValue: putKVValueMock,
        getKVValue: getKVValueMock,
      },
    });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw
    }

    // Should have called putKVValue for the health check key
    expect(putKVValueMock.mock.calls.length).toBeGreaterThan(0);

    restoreBunFile(originalBunFile);
  });

  it("should check queues via listQueues", async () => {
    const listQueuesMock = mock(async () => [
      { queue_name: "trade-queue" },
      { queue_name: "signal-queue" },
    ]);

    const cmd = new HousekeepingCommand();
    const mockCtx = createMockContext({
      cloudflare: { listQueues: listQueuesMock },
    });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw
    }

    expect(listQueuesMock).toHaveBeenCalled();

    restoreBunFile(originalBunFile);
  });

  it("should check error logs via D1 query", async () => {
    const executeD1QueryMock = mock(async (_dbName: string, sql: string) => {
      if (sql.includes("COUNT")) {
        return { results: [{ error_count: 0 }] };
      }
      if (sql.includes("SELECT 1")) {
        return { results: [{ health_check: 1 }] };
      }
      return { results: [] };
    });

    const cmd = new HousekeepingCommand();
    const mockCtx = createMockContext({
      cloudflare: { executeD1Query: executeD1QueryMock },
    });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw
    }

    // Should have called executeD1Query for error log check
    const calls = executeD1QueryMock.mock.calls;
    const errorLogCall = calls.find(
      (call: any[]) => call[1]?.includes("system_logs") && call[1]?.includes("ERROR")
    );
    expect(errorLogCall).toBeDefined();

    restoreBunFile(originalBunFile);
  });

  it("should apply --fix flag to cleanup old logs", async () => {
    const executeD1QueryMock = mock(async (_dbName: string, sql: string) => {
      if (sql.includes("DELETE FROM system_logs")) {
        return { results: [] };
      }
      if (sql.includes("COUNT")) {
        return { results: [{ error_count: 5 }] };
      }
      if (sql.includes("SELECT 1")) {
        return { results: [{ health_check: 1 }] };
      }
      return { results: [] };
    });

    const cmd = new HousekeepingCommand();
    const mockCtx = createMockContext({
      args: { fix: true },
      cloudflare: { executeD1Query: executeD1QueryMock },
    });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw
    }

    // Should have called executeD1Query with DELETE for log cleanup
    const calls = executeD1QueryMock.mock.calls;
    const deleteCall = calls.find(
      (call: any[]) => call[1]?.includes("DELETE FROM system_logs")
    );
    expect(deleteCall).toBeDefined();

    restoreBunFile(originalBunFile);
  });

  it("should not cleanup logs when --fix is not set", async () => {
    const executeD1QueryMock = mock(async (_dbName: string, sql: string) => {
      if (sql.includes("DELETE FROM system_logs")) {
        return { results: [] };
      }
      if (sql.includes("COUNT")) {
        return { results: [{ error_count: 5 }] };
      }
      if (sql.includes("SELECT 1")) {
        return { results: [{ health_check: 1 }] };
      }
      return { results: [] };
    });

    const cmd = new HousekeepingCommand();
    const mockCtx = createMockContext({
      args: { fix: false },
      cloudflare: { executeD1Query: executeD1QueryMock },
    });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw
    }

    // Should NOT have called executeD1Query with DELETE
    const calls = executeD1QueryMock.mock.calls;
    const deleteCall = calls.find(
      (call: any[]) => call[1]?.includes("DELETE FROM system_logs")
    );
    expect(deleteCall).toBeUndefined();

    restoreBunFile(originalBunFile);
  });

  it("should throw CLIError when workers.jsonc is missing", async () => {
    const cmd = new HousekeepingCommand();
    const mockCtx = createMockContext();

    const originalBunFile = Bun.file;
    (Bun as any).file = mock((_path: string) => ({
      exists: mock(async () => false),
    }));

    try {
      await cmd.execute(mockCtx);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain("workers.jsonc not found");
    }

    restoreBunFile(originalBunFile);
  });

  it("should handle degraded worker health gracefully", async () => {
    const cmd = new HousekeepingCommand();
    const mockCtx = createMockContext({
      cloudflare: {
        getWorkerHealth: mock(async (name: string) => ({
          name,
          status: "degraded" as const,
          errorRate: 0.05,
        })),
      },
    });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw
    }

    // Should still succeed (degraded is not critical)
    const stateCalls = (mockCtx.observer.setState as any).mock.calls;
    const successCall = stateCalls.find(
      (call: any[]) => call[0]?.commandStatus === "success"
    );
    expect(successCall).toBeDefined();

    restoreBunFile(originalBunFile);
  });

  it("should handle missing KV namespace gracefully", async () => {
    const cmd = new HousekeepingCommand();
    const mockCtx = createMockContext({
      cloudflare: {
        listKVNamespaces: mock(async () => []),
      },
    });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw
    }

    // Should still complete (degraded, not critical)
    const stateCalls = (mockCtx.observer.setState as any).mock.calls;
    // Should have some state update
    expect(stateCalls.length).toBeGreaterThan(0);

    restoreBunFile(originalBunFile);
  });

  it("should handle empty queues gracefully", async () => {
    const cmd = new HousekeepingCommand();
    const mockCtx = createMockContext({
      cloudflare: {
        listQueues: mock(async () => []),
      },
    });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw
    }

    // Should still complete (degraded, not critical)
    const stateCalls = (mockCtx.observer.setState as any).mock.calls;
    expect(stateCalls.length).toBeGreaterThan(0);

    restoreBunFile(originalBunFile);
  });

  it("should include recommendations in JSON output", async () => {
    const cmd = new HousekeepingCommand();
    const logSpy = mock((..._args: unknown[]) => {});
    const originalLog = console.log;
    console.log = logSpy;

    const mockCtx = createMockContext({
      args: { json: true },
      cloudflare: {
        listQueues: mock(async () => []), // No queues — should generate recommendation
      },
    });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw
    }

    const jsonCalls = logSpy.mock.calls.filter((call: any[]) => {
      try {
        const parsed = JSON.parse(call[0]);
        return parsed.timestamp !== undefined && parsed.overall !== undefined;
      } catch {
        return false;
      }
    });

    if (jsonCalls.length > 0) {
      const report = JSON.parse(jsonCalls[0][0] as string);
      expect(Array.isArray(report.recommendations)).toBe(true);
    }

    console.log = originalLog;
    restoreBunFile(originalBunFile);
  });

  it("should include fixes in JSON output when --fix is applied", async () => {
    const cmd = new HousekeepingCommand();
    const logSpy = mock((..._args: unknown[]) => {});
    const originalLog = console.log;
    console.log = logSpy;

    const mockCtx = createMockContext({
      args: { json: true, fix: true },
    });
    const originalBunFile = mockBunFile();

    try {
      await cmd.execute(mockCtx);
    } catch {
      // May throw
    }

    const jsonCalls = logSpy.mock.calls.filter((call: any[]) => {
      try {
        const parsed = JSON.parse(call[0]);
        return parsed.timestamp !== undefined && parsed.overall !== undefined;
      } catch {
        return false;
      }
    });

    if (jsonCalls.length > 0) {
      const report = JSON.parse(jsonCalls[0][0] as string);
      // Fixes should be present (even if empty array) when --fix is set
      expect(report).toHaveProperty("fixes");
    }

    console.log = originalLog;
    restoreBunFile(originalBunFile);
  });
});