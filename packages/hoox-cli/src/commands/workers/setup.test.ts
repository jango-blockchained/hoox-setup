import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { WorkersSetupCommand } from "./setup.js";
import type { CommandContext } from "../../core/types.js";
import { mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";

describe("WorkersSetupCommand", () => {
  let command: WorkersSetupCommand;
  let mockCtx: CommandContext;
  let tmpDir: string;

  const WORKERS_JSONC = `{
  "global": {
    "cloudflare_account_id": "test-account-id",
    "subdomain_prefix": "cryptolinx"
  },
  "workers": {
    "d1-worker": {
      "enabled": true,
      "path": "workers/d1-worker",
      "vars": {
        "database_name": "my-database"
      }
    },
    "telegram-worker": {
      "enabled": true,
      "path": "workers/telegram-worker",
      "vars": {},
      "secrets": ["TELEGRAM_BOT_TOKEN"]
    },
    "trade-worker": {
      "enabled": true,
      "path": "workers/trade-worker",
      "vars": {},
      "secrets": ["API_SERVICE_KEY", "BINANCE_API_KEY"]
    },
    "hoox": {
      "enabled": true,
      "path": "workers/hoox",
      "vars": {},
      "secrets": ["WEBHOOK_API_KEY_BINDING"]
    },
    "disabled-worker": {
      "enabled": false,
      "path": "workers/disabled-worker",
      "secrets": ["SOME_SECRET"]
    }
  }
}`;

  const MINIMAL_WORKERS_JSONC = `{
  "global": {
    "cloudflare_account_id": "test-account-id",
    "subdomain_prefix": "cryptolinx"
  },
  "workers": {
    "hoox": {
      "enabled": true,
      "path": "workers/hoox",
      "vars": {},
      "secrets": ["WEBHOOK_API_KEY_BINDING"]
    }
  }
}`;

  const NO_SECRETS_WORKERS_JSONC = `{
  "global": {
    "cloudflare_account_id": "test-account-id",
    "subdomain_prefix": "cryptolinx"
  },
  "workers": {
    "d1-worker": {
      "enabled": true,
      "path": "workers/d1-worker",
      "vars": {
        "database_name": "my-database"
      }
    }
  }
}`;

  function createMockCtx(overrides?: Partial<CommandContext>): CommandContext {
    const setSecretMock = mock(async () => {});
    const promptSecretMock = mock(async (_prompt: string) => "test-secret-value");

    return {
      observer: {
        emit: mock(() => {}),
        getState: mock(() => ({ workers: {} })),
        setState: mock(() => {}),
        subscribe: mock(() => () => {}),
        on: mock(() => () => {}),
      } as any,
      engine: {} as any,
      adapters: {
        cloudflare: {
          setSecret: setSecretMock,
          listSecrets: mock(async () => []),
        } as any,
        bun: {
          promptSecret: promptSecretMock,
          readFile: mock(async () => ""),
          writeFile: mock(async () => {}),
        } as any,
        workers: {} as any,
      },
      cwd: tmpDir,
      args: {},
      ...overrides,
    } as CommandContext;
  }

  function setupWorkerDirs(workers: Record<string, string>): void {
    for (const [name, path] of Object.entries(workers)) {
      const workerDir = join(tmpDir, path);
      mkdirSync(workerDir, { recursive: true });
      writeFileSync(join(workerDir, "wrangler.jsonc"), `{ "name": "${name}" }`);
    }
  }

  beforeEach(() => {
    command = new WorkersSetupCommand();
    tmpDir = join(process.cwd(), `.tmp-test-setup-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    mockCtx = createMockCtx();
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  // ── Command metadata ──

  it("should have correct name and description", () => {
    expect(command.name).toBe("workers:setup");
    expect(command.description).toBe("Bind secrets and provision environment");
  });

  it("should have worker option", () => {
    expect(command.options).toBeDefined();
    const workerOption = command.options?.find((o) => o.flag === "worker");
    expect(workerOption).toBeDefined();
    expect(workerOption?.type).toBe("string");
    expect(workerOption?.short).toBe("w");
  });

  it("should have all option", () => {
    const allOption = command.options?.find((o) => o.flag === "all");
    expect(allOption).toBeDefined();
    expect(allOption?.type).toBe("boolean");
    expect(allOption?.short).toBe("a");
  });

  // ── Config reading ──

  it("should read workers.jsonc correctly", async () => {
    const readWorkersConfig = (command as any).readWorkersConfig.bind(command);
    writeFileSync(join(tmpDir, "workers.jsonc"), WORKERS_JSONC);

    const config = await readWorkersConfig(`${tmpDir}/workers.jsonc`);

    expect(config.global.cloudflare_account_id).toBe("test-account-id");
    expect(config.global.subdomain_prefix).toBe("cryptolinx");
    expect(config.workers["telegram-worker"]).toBeDefined();
    expect(config.workers["telegram-worker"].secrets).toEqual(["TELEGRAM_BOT_TOKEN"]);
  });

  it("should throw CLIError when workers.jsonc is missing", async () => {
    const readWorkersConfig = (command as any).readWorkersConfig.bind(command);

    try {
      await readWorkersConfig(`${tmpDir}/nonexistent.jsonc`);
      expect.unreachable("Should have thrown");
    } catch (error: any) {
      expect(error.code).toBe("CONFIG_NOT_FOUND");
      expect(error.message).toContain("workers.jsonc not found");
    }
  });

  it("should throw CLIError when workers.jsonc is invalid", async () => {
    const readWorkersConfig = (command as any).readWorkersConfig.bind(command);
    writeFileSync(join(tmpDir, "workers.jsonc"), `{ "invalid": true }`);

    try {
      await readWorkersConfig(`${tmpDir}/workers.jsonc`);
      expect.unreachable("Should have thrown");
    } catch (error: any) {
      expect(error.code).toBe("CONFIG_INVALID");
      expect(error.message).toContain("missing global or workers section");
    }
  });

  // ── Worker filtering ──

  it("should filter to specific worker with --worker flag", () => {
    const filterWorkers = (command as any).filterWorkers.bind(command);

    const config = {
      global: { cloudflare_account_id: "test", subdomain_prefix: "test" },
      workers: {
        "hoox": { enabled: true, path: "workers/hoox", secrets: ["KEY"] },
        "trade-worker": { enabled: true, path: "workers/trade-worker", secrets: ["API_KEY"] },
      },
    };

    const result = filterWorkers(config, "hoox", false);
    expect(Object.keys(result)).toEqual(["hoox"]);
  });

  it("should throw CLIError when --worker specifies unknown worker", () => {
    const filterWorkers = (command as any).filterWorkers.bind(command);

    const config = {
      global: { cloudflare_account_id: "test", subdomain_prefix: "test" },
      workers: {
        "hoox": { enabled: true, path: "workers/hoox" },
      },
    };

    try {
      filterWorkers(config, "nonexistent", false);
      expect.unreachable("Should have thrown");
    } catch (error: any) {
      expect(error.code).toBe("WORKER_NOT_FOUND");
    }
  });

  it("should throw CLIError when --worker specifies disabled worker", () => {
    const filterWorkers = (command as any).filterWorkers.bind(command);

    const config = {
      global: { cloudflare_account_id: "test", subdomain_prefix: "test" },
      workers: {
        "disabled-worker": { enabled: false, path: "workers/disabled-worker" },
      },
    };

    try {
      filterWorkers(config, "disabled-worker", false);
      expect.unreachable("Should have thrown");
    } catch (error: any) {
      expect(error.code).toBe("WORKER_DISABLED");
    }
  });

  it("should return all enabled workers with --all flag", () => {
    const filterWorkers = (command as any).filterWorkers.bind(command);

    const config = {
      global: { cloudflare_account_id: "test", subdomain_prefix: "test" },
      workers: {
        "hoox": { enabled: true, path: "workers/hoox" },
        "trade-worker": { enabled: true, path: "workers/trade-worker" },
        "disabled-worker": { enabled: false, path: "workers/disabled-worker" },
      },
    };

    const result = filterWorkers(config, undefined, true);
    expect(Object.keys(result)).toEqual(["hoox", "trade-worker"]);
  });

  it("should return all enabled workers by default (no flags)", () => {
    const filterWorkers = (command as any).filterWorkers.bind(command);

    const config = {
      global: { cloudflare_account_id: "test", subdomain_prefix: "test" },
      workers: {
        "hoox": { enabled: true, path: "workers/hoox" },
        "trade-worker": { enabled: true, path: "workers/trade-worker" },
        "disabled-worker": { enabled: false, path: "workers/disabled-worker" },
      },
    };

    const result = filterWorkers(config, undefined, false);
    expect(Object.keys(result)).toEqual(["hoox", "trade-worker"]);
  });

  // ── Full execution ──

  it("should emit command:start on execute", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), MINIMAL_WORKERS_JSONC);
    setupWorkerDirs({ hoox: "workers/hoox" });
    mockCtx.args = { all: true };

    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "workers:setup" })
    );
  });

  it("should set success state when setup completes", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), MINIMAL_WORKERS_JSONC);
    setupWorkerDirs({ hoox: "workers/hoox" });
    mockCtx.args = { all: true };

    await command.execute(mockCtx);

    expect(mockCtx.observer.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "success" })
    );
  });

  it("should call setSecret for each secret in worker config", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), MINIMAL_WORKERS_JSONC);
    setupWorkerDirs({ hoox: "workers/hoox" });
    mockCtx.args = { all: true };

    await command.execute(mockCtx);

    expect(mockCtx.adapters.cloudflare.setSecret).toHaveBeenCalledWith(
      "hoox",
      "WEBHOOK_API_KEY_BINDING",
      "test-secret-value"
    );
  });

  it("should create .dev.vars file with secrets", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), MINIMAL_WORKERS_JSONC);
    setupWorkerDirs({ hoox: "workers/hoox" });
    mockCtx.args = { all: true };

    await command.execute(mockCtx);

    const devVarsPath = join(tmpDir, "workers/hoox/.dev.vars");
    expect(existsSync(devVarsPath)).toBe(true);
    const content = await Bun.file(devVarsPath).text();
    expect(content).toContain('WEBHOOK_API_KEY_BINDING="test-secret-value"');
  });

  it("should handle multiple secrets for a worker", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), WORKERS_JSONC);
    setupWorkerDirs({
      "telegram-worker": "workers/telegram-worker",
      "trade-worker": "workers/trade-worker",
      "hoox": "workers/hoox",
      "d1-worker": "workers/d1-worker",
    });
    mockCtx.args = { worker: "trade-worker" };

    await command.execute(mockCtx);

    // trade-worker has 2 secrets: API_SERVICE_KEY and BINANCE_API_KEY
    expect(mockCtx.adapters.cloudflare.setSecret).toHaveBeenCalledTimes(2);
    expect(mockCtx.adapters.cloudflare.setSecret).toHaveBeenCalledWith(
      "trade-worker",
      "API_SERVICE_KEY",
      "test-secret-value"
    );
    expect(mockCtx.adapters.cloudflare.setSecret).toHaveBeenCalledWith(
      "trade-worker",
      "BINANCE_API_KEY",
      "test-secret-value"
    );
  });

  it("should skip secrets when user provides empty value", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), MINIMAL_WORKERS_JSONC);
    setupWorkerDirs({ hoox: "workers/hoox" });
    mockCtx.args = { all: true };

    // Override promptSecret to return empty string
    (mockCtx.adapters.bun as any).promptSecret = mock(async () => "");

    await command.execute(mockCtx);

    // setSecret should NOT be called for empty values
    expect(mockCtx.adapters.cloudflare.setSecret).not.toHaveBeenCalled();
  });

  it("should set error state when workers.jsonc is missing", async () => {
    // No workers.jsonc created
    mockCtx.args = { all: true };

    await command.execute(mockCtx);

    expect(mockCtx.observer.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "error" })
    );
  });

  it("should set error state when wrangler.jsonc is missing for a worker", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), MINIMAL_WORKERS_JSONC);
    // Create worker dir but WITHOUT wrangler.jsonc
    mkdirSync(join(tmpDir, "workers/hoox"), { recursive: true });
    mockCtx.args = { all: true };

    await command.execute(mockCtx);

    // Should have errors due to missing wrangler.jsonc
    expect(mockCtx.observer.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "error" })
    );
  });

  it("should handle --worker flag for single worker setup", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), WORKERS_JSONC);
    setupWorkerDirs({ hoox: "workers/hoox" });
    mockCtx.args = { worker: "hoox" };

    await command.execute(mockCtx);

    // Only hoox's secret should be set
    expect(mockCtx.adapters.cloudflare.setSecret).toHaveBeenCalledWith(
      "hoox",
      "WEBHOOK_API_KEY_BINDING",
      "test-secret-value"
    );
  });

  it("should throw CLIError when --worker specifies nonexistent worker", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), MINIMAL_WORKERS_JSONC);
    mockCtx.args = { worker: "nonexistent" };

    await command.execute(mockCtx);

    expect(mockCtx.observer.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "error" })
    );
  });

  it("should handle workers with no secrets", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), NO_SECRETS_WORKERS_JSONC);
    setupWorkerDirs({ "d1-worker": "workers/d1-worker" });
    mockCtx.args = { all: true };

    await command.execute(mockCtx);

    // No secrets to set, should still succeed
    expect(mockCtx.adapters.cloudflare.setSecret).not.toHaveBeenCalled();
    expect(mockCtx.observer.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "success" })
    );
  });

  it("should include vars in .dev.vars when worker has vars", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), NO_SECRETS_WORKERS_JSONC);
    setupWorkerDirs({ "d1-worker": "workers/d1-worker" });
    mockCtx.args = { all: true };

    await command.execute(mockCtx);

    const devVarsPath = join(tmpDir, "workers/d1-worker/.dev.vars");
    expect(existsSync(devVarsPath)).toBe(true);
    const content = await Bun.file(devVarsPath).text();
    expect(content).toContain('database_name="my-database"');
  });

  it("should continue processing other workers when one has errors", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), WORKERS_JSONC);
    // Only set up some worker dirs (hoox has wrangler, telegram-worker doesn't)
    setupWorkerDirs({ hoox: "workers/hoox" });
    mkdirSync(join(tmpDir, "workers/telegram-worker"), { recursive: true });
    // No wrangler.jsonc for telegram-worker
    mockCtx.args = { all: true };

    await command.execute(mockCtx);

    // hoox should still be processed even though telegram-worker has errors
    expect(mockCtx.adapters.cloudflare.setSecret).toHaveBeenCalledWith(
      "hoox",
      "WEBHOOK_API_KEY_BINDING",
      "test-secret-value"
    );
  });

  it("should handle setSecret failure gracefully", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), MINIMAL_WORKERS_JSONC);
    setupWorkerDirs({ hoox: "workers/hoox" });
    mockCtx.args = { all: true };

    // Make setSecret throw
    (mockCtx.adapters.cloudflare as any).setSecret = mock(async () => {
      throw new Error("API error");
    });

    await command.execute(mockCtx);

    // Should complete with errors, not crash
    expect(mockCtx.observer.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "error" })
    );
  });
});