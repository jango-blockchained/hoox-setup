import { describe, it, expect, beforeEach, mock } from "bun:test";
import { CheckSetupCommand } from "./index.js";
import type { CommandContext } from "../../core/types.js";

/**
 * Helper to create a mock CommandContext with all required adapters.
 */
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
    } as any,
    engine: {} as any,
    adapters: {
      cloudflare: {
        listD1Databases: mock(async () => [
          { uuid: "test-uuid", name: "my-database", title: "My Database" },
        ]),
        listKVNamespaces: mock(async () => []),
        listR2Buckets: mock(async () => []),
        listQueues: mock(async () => []),
        listSecrets: mock(async () => []),
        executeD1Query: mock(async () => ({
          results: [
            { name: "trade_signals" },
            { name: "trades" },
            { name: "positions" },
            { name: "balances" },
            { name: "system_logs" },
            { name: "signal_events" },
            { name: "event_trace" },
            { name: "worker_stats" },
            { name: "idx_trade_signals_timestamp" },
            { name: "idx_trades_timestamp" },
            { name: "idx_positions_status" },
            { name: "idx_system_logs_timestamp" },
          ],
        })),
        ...overrides.cloudflare,
      } as any,
      bun: {} as any,
      workers: {} as any,
    },
    cwd: overrides.cwd || "/test",
    args: overrides.args,
  };
}

describe("CheckSetupCommand", () => {
  let command: CheckSetupCommand;

  beforeEach(() => {
    command = new CheckSetupCommand();
  });

  it("should have correct name and description", () => {
    expect(command.name).toBe("check-setup");
    expect(command.description).toBe(
      "Validate system setup (config, infrastructure, secrets, database)"
    );
  });

  it("should have json and worker options", () => {
    expect(command.options).toBeDefined();
    const jsonOption = command.options?.find((o) => o.flag === "json");
    expect(jsonOption).toBeDefined();
    expect(jsonOption?.type).toBe("boolean");
    expect(jsonOption?.short).toBe("j");

    const workerOption = command.options?.find((o) => o.flag === "worker");
    expect(workerOption).toBeDefined();
    expect(workerOption?.type).toBe("string");
    expect(workerOption?.short).toBe("w");
  });

  it("should emit command:start on execute", async () => {
    const mockCtx = createMockContext();

    // Mock Bun.file to simulate workers.jsonc and other files
    const originalBunFile = Bun.file;
    (Bun as any).file = mock((path: string) => {
      if (path.endsWith("workers.jsonc")) {
        return {
          exists: mock(async () => true),
          text: mock(async () =>
            JSON.stringify({
              global: {
                cloudflare_account_id: "test-account-id",
                subdomain_prefix: "test",
              },
              workers: {
                "d1-worker": {
                  enabled: true,
                  path: "workers/d1-worker",
                  vars: { database_name: "my-database" },
                },
                "hoox": {
                  enabled: true,
                  path: "workers/hoox",
                  secrets: ["WEBHOOK_API_KEY_BINDING"],
                },
              },
            })
          ),
        };
      }
      if (path.endsWith("wrangler.jsonc") || path.endsWith("wrangler.toml")) {
        return {
          exists: mock(async () => true),
          text: mock(async () => '{"name": "test-worker"}'),
        };
      }
      if (path.endsWith(".env.local")) {
        return {
          exists: mock(async () => true),
          text: mock(
            async () =>
              "CLOUDFLARE_API_TOKEN=real_token\nCLOUDFLARE_ACCOUNT_ID=test-account-id\n"
          ),
        };
      }
      if (path.endsWith("package.json")) {
        return { exists: mock(async () => true) };
      }
      if (path.endsWith(".dev.vars")) {
        return {
          exists: mock(async () => true),
          text: mock(async () => ""),
        };
      }
      return { exists: mock(async () => false) };
    });

    try {
      await command.execute(mockCtx);
    } catch {
      // May throw CLIError on validation failure — that's expected
    }

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "check-setup" })
    );

    (Bun as any).file = originalBunFile;
  });

  it("should throw CLIError when workers.jsonc is missing", async () => {
    const mockCtx = createMockContext();

    const originalBunFile = Bun.file;
    (Bun as any).file = mock((_path: string) => ({
      exists: mock(async () => false),
    }));

    try {
      await command.execute(mockCtx);
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      // CLIError wraps the original — check message contains key text
      expect(error.message).toContain("workers.jsonc not found");
    }

    (Bun as any).file = originalBunFile;
  });

  it("should throw CLIError when --worker specifies unknown worker", async () => {
    const mockCtx = createMockContext({
      args: { worker: "nonexistent-worker" },
    });

    const originalBunFile = Bun.file;
    (Bun as any).file = mock((path: string) => {
      if (path.endsWith("workers.jsonc")) {
        return {
          exists: mock(async () => true),
          text: mock(async () =>
            JSON.stringify({
              global: { cloudflare_account_id: "test", subdomain_prefix: "test" },
              workers: {
                hoox: { enabled: true, path: "workers/hoox" },
              },
            })
          ),
        };
      }
      return { exists: mock(async () => false) };
    });

    try {
      await command.execute(mockCtx);
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain("nonexistent-worker");
      expect(error.message).toContain("not found");
    }

    (Bun as any).file = originalBunFile;
  });

  it("should output JSON when --json flag is set", async () => {
    const mockCtx = createMockContext({ args: { json: true } });
    const logSpy = mock((..._args: unknown[]) => {});
    const originalLog = console.log;
    console.log = logSpy;

    const originalBunFile = Bun.file;
    (Bun as any).file = mock((path: string) => {
      if (path.endsWith("workers.jsonc")) {
        return {
          exists: mock(async () => true),
          text: mock(async () =>
            JSON.stringify({
              global: {
                cloudflare_account_id: "test-account-id",
                subdomain_prefix: "test",
              },
              workers: {
                "d1-worker": {
                  enabled: true,
                  path: "workers/d1-worker",
                  vars: { database_name: "my-database" },
                },
              },
            })
          ),
        };
      }
      if (path.endsWith("wrangler.jsonc") || path.endsWith("wrangler.toml")) {
        return {
          exists: mock(async () => true),
          text: mock(async () => '{"name": "test"}'),
        };
      }
      if (path.endsWith(".env.local")) {
        return {
          exists: mock(async () => true),
          text: mock(
            async () =>
              "CLOUDFLARE_API_TOKEN=real_token\nCLOUDFLARE_ACCOUNT_ID=test-account-id\n"
          ),
        };
      }
      if (path.endsWith("package.json")) {
        return { exists: mock(async () => true) };
      }
      if (path.endsWith(".dev.vars")) {
        return {
          exists: mock(async () => true),
          text: mock(async () => ""),
        };
      }
      return { exists: mock(async () => false) };
    });

    try {
      await command.execute(mockCtx);
    } catch {
      // CLIError on validation failure is expected
    }

    // Verify JSON was output
    const jsonCalls = logSpy.mock.calls.filter(
      (call: any[]) => {
        try {
          const parsed = JSON.parse(call[0]);
          return parsed.success !== undefined && parsed.categories !== undefined;
        } catch {
          return false;
        }
      }
    );
    expect(jsonCalls.length).toBeGreaterThan(0);

    const report = JSON.parse(jsonCalls[0][0] as string);
    expect(report).toHaveProperty("success");
    expect(report).toHaveProperty("categories");
    expect(report).toHaveProperty("summary");
    expect(report.summary).toHaveProperty("total");
    expect(report.summary).toHaveProperty("passed");
    expect(report.summary).toHaveProperty("failed");

    console.log = originalLog;
    (Bun as any).file = originalBunFile;
  });

  it("should set observer state to success when all checks pass", async () => {
    const mockCtx = createMockContext();

    const originalBunFile = Bun.file;
    (Bun as any).file = mock((path: string) => {
      if (path.endsWith("workers.jsonc")) {
        return {
          exists: mock(async () => true),
          text: mock(async () =>
            JSON.stringify({
              global: {
                cloudflare_account_id: "test-account-id",
                subdomain_prefix: "test",
              },
              workers: {
                "d1-worker": {
                  enabled: true,
                  path: "workers/d1-worker",
                  vars: { database_name: "my-database" },
                },
              },
            })
          ),
        };
      }
      if (path.endsWith("wrangler.jsonc") || path.endsWith("wrangler.toml")) {
        return {
          exists: mock(async () => true),
          text: mock(async () => '{"name": "test"}'),
        };
      }
      if (path.endsWith(".env.local")) {
        return {
          exists: mock(async () => true),
          text: mock(
            async () =>
              "CLOUDFLARE_API_TOKEN=real_token\nCLOUDFLARE_ACCOUNT_ID=test-account-id\n"
          ),
        };
      }
      if (path.endsWith("package.json")) {
        return { exists: mock(async () => true) };
      }
      if (path.endsWith(".dev.vars")) {
        return {
          exists: mock(async () => true),
          text: mock(async () => ""),
        };
      }
      return { exists: mock(async () => false) };
    });

    try {
      await command.execute(mockCtx);
    } catch {
      // May throw on failure
    }

    // Verify setState was called with success
    const stateCalls = (mockCtx.observer.setState as any).mock.calls;
    const successCall = stateCalls.find(
      (call: any[]) => call[0]?.commandStatus === "success"
    );
    expect(successCall).toBeDefined();

    (Bun as any).file = originalBunFile;
  });

  it("should set observer state to error when checks fail", async () => {
    // Simulate missing D1 database
    const mockCtx = createMockContext({
      cloudflare: {
        listD1Databases: mock(async () => []), // No databases found
      },
    });

    const originalBunFile = Bun.file;
    (Bun as any).file = mock((path: string) => {
      if (path.endsWith("workers.jsonc")) {
        return {
          exists: mock(async () => true),
          text: mock(async () =>
            JSON.stringify({
              global: {
                cloudflare_account_id: "test-account-id",
                subdomain_prefix: "test",
              },
              workers: {
                "d1-worker": {
                  enabled: true,
                  path: "workers/d1-worker",
                  vars: { database_name: "my-database" },
                },
              },
            })
          ),
        };
      }
      if (path.endsWith("wrangler.jsonc") || path.endsWith("wrangler.toml")) {
        return {
          exists: mock(async () => true),
          text: mock(async () => '{"name": "test"}'),
        };
      }
      if (path.endsWith(".env.local")) {
        return {
          exists: mock(async () => true),
          text: mock(
            async () =>
              "CLOUDFLARE_API_TOKEN=real_token\nCLOUDFLARE_ACCOUNT_ID=test-account-id\n"
          ),
        };
      }
      if (path.endsWith("package.json")) {
        return { exists: mock(async () => true) };
      }
      if (path.endsWith(".dev.vars")) {
        return {
          exists: mock(async () => true),
          text: mock(async () => ""),
        };
      }
      return { exists: mock(async () => false) };
    });

    try {
      await command.execute(mockCtx);
    } catch {
      // Expected to throw CLIError
    }

    // Verify setState was called with error
    const stateCalls = (mockCtx.observer.setState as any).mock.calls;
    const errorCall = stateCalls.find(
      (call: any[]) => call[0]?.commandStatus === "error"
    );
    expect(errorCall).toBeDefined();

    (Bun as any).file = originalBunFile;
  });

  it("should filter to specific worker when --worker is set", async () => {
    const mockCtx = createMockContext({
      args: { worker: "hoox" },
    });

    const originalBunFile = Bun.file;
    (Bun as any).file = mock((path: string) => {
      if (path.endsWith("workers.jsonc")) {
        return {
          exists: mock(async () => true),
          text: mock(async () =>
            JSON.stringify({
              global: {
                cloudflare_account_id: "test-account-id",
                subdomain_prefix: "test",
              },
              workers: {
                hoox: {
                  enabled: true,
                  path: "workers/hoox",
                  secrets: ["WEBHOOK_API_KEY_BINDING"],
                },
                "d1-worker": {
                  enabled: true,
                  path: "workers/d1-worker",
                  vars: { database_name: "my-database" },
                },
              },
            })
          ),
        };
      }
      if (path.endsWith("wrangler.jsonc") || path.endsWith("wrangler.toml")) {
        return {
          exists: mock(async () => true),
          text: mock(async () => '{"name": "test"}'),
        };
      }
      if (path.endsWith(".env.local")) {
        return {
          exists: mock(async () => true),
          text: mock(
            async () =>
              "CLOUDFLARE_API_TOKEN=real_token\nCLOUDFLARE_ACCOUNT_ID=test-account-id\n"
          ),
        };
      }
      if (path.endsWith("package.json")) {
        return { exists: mock(async () => true) };
      }
      if (path.endsWith(".dev.vars")) {
        return {
          exists: mock(async () => true),
          text: mock(async () => ""),
        };
      }
      return { exists: mock(async () => false) };
    });

    try {
      await command.execute(mockCtx);
    } catch {
      // May throw on failure
    }

    // Verify that listSecrets was called only for the "hoox" worker
    const listSecretsCalls = (mockCtx.adapters.cloudflare.listSecrets as any).mock.calls;
    // checkWorkerSecrets should be called with specificWorker="hoox"
    // which means it only checks that worker's secrets
    const calledWorkers = listSecretsCalls.map((call: any[]) => call[0]);
    // Only "hoox" should be checked (not "d1-worker" which has no secrets)
    expect(calledWorkers).toContain("hoox");

    (Bun as any).file = originalBunFile;
  });
});
