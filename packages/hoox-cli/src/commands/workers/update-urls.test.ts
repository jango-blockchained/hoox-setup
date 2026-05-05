import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { WorkersUpdateInternalUrlsCommand } from "./update-urls.js";
import type { CommandContext } from "../../core/types.js";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { parse, modify, applyEdits } from "jsonc-parser";

describe("WorkersUpdateInternalUrlsCommand", () => {
  let command: WorkersUpdateInternalUrlsCommand;
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
      "path": "workers/d1-worker"
    },
    "agent-worker": {
      "enabled": true,
      "path": "workers/agent-worker"
    },
    "trade-worker": {
      "enabled": true,
      "path": "workers/trade-worker"
    },
    "telegram-worker": {
      "enabled": true,
      "path": "workers/telegram-worker"
    }
  }
}`;

  const DASHBOARD_WRANGLER = `{
  "name": "hoox-dashboard",
  "main": ".open-next/worker.js",
  "vars": {
    "D1_WORKER_URL": "https://d1-worker.old-prefix.workers.dev",
    "AGENT_SERVICE_URL": "https://agent-worker.old-prefix.workers.dev",
    "TRADE_SERVICE_URL": "https://trade-worker.old-prefix.workers.dev",
    "TELEGRAM_SERVICE_URL": "https://telegram-worker.old-prefix.workers.dev"
  }
}`;

  const DASHBOARD_WRANGLER_UP_TO_DATE = `{
  "name": "hoox-dashboard",
  "main": ".open-next/worker.js",
  "vars": {
    "D1_WORKER_URL": "https://d1-worker.cryptolinx.workers.dev",
    "AGENT_SERVICE_URL": "https://agent-worker.cryptolinx.workers.dev",
    "TRADE_SERVICE_URL": "https://trade-worker.cryptolinx.workers.dev",
    "TELEGRAM_SERVICE_URL": "https://telegram-worker.cryptolinx.workers.dev"
  }
}`;

  beforeEach(() => {
    command = new WorkersUpdateInternalUrlsCommand();
    tmpDir = join(process.cwd(), ".tmp-test-update-urls-" + Date.now());
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, "pages", "dashboard"), { recursive: true });

    mockCtx = {
      observer: {
        emit: mock(() => {}),
        getState: mock(() => ({ workers: {} })),
        setState: mock(() => {}),
        subscribe: mock(() => () => {}),
        on: mock(() => () => {}),
      } as any,
      engine: {} as any,
      adapters: {
        cloudflare: {} as any,
        bun: {
          readFile: mock(async () => "{}"),
          writeFile: mock(async () => {}),
        } as any,
        workers: {} as any,
      },
      cwd: tmpDir,
    };
  });

  afterEach(() => {
    try {
      rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  it("should have correct name and description", () => {
    expect(command.name).toBe("workers:update-internal-urls");
    expect(command.description).toBe(
      "Update dashboard wrangler.jsonc with worker service URLs",
    );
  });

  it("should have dry-run and custom-domain options", () => {
    expect(command.options).toBeDefined();
    const dryRunOption = command.options?.find((o) => o.flag === "dry-run");
    expect(dryRunOption).toBeDefined();
    expect(dryRunOption?.type).toBe("boolean");

    const customDomainOption = command.options?.find(
      (o) => o.flag === "custom-domain",
    );
    expect(customDomainOption).toBeDefined();
    expect(customDomainOption?.type).toBe("string");
  });

  it("should compute correct default workers.dev URLs", () => {
    const buildUrlMap = (command as any).buildUrlMap.bind(command);

    const config = {
      global: { cloudflare_account_id: "test", subdomain_prefix: "myapp" },
      workers: {
        "d1-worker": { enabled: true, path: "workers/d1-worker" },
        "agent-worker": { enabled: true, path: "workers/agent-worker" },
        "trade-worker": { enabled: true, path: "workers/trade-worker" },
        "telegram-worker": { enabled: true, path: "workers/telegram-worker" },
      },
    };

    const urlMap = buildUrlMap("myapp", config, {});

    expect(urlMap.D1_WORKER_URL).toBe("https://d1-worker.myapp.workers.dev");
    expect(urlMap.AGENT_SERVICE_URL).toBe("https://agent-worker.myapp.workers.dev");
    expect(urlMap.TRADE_SERVICE_URL).toBe("https://trade-worker.myapp.workers.dev");
    expect(urlMap.TELEGRAM_SERVICE_URL).toBe("https://telegram-worker.myapp.workers.dev");
  });

  it("should apply custom domain overrides from CLI arg", () => {
    const buildUrlMap = (command as any).buildUrlMap.bind(command);

    const config = {
      global: { cloudflare_account_id: "test", subdomain_prefix: "myapp" },
      workers: {
        "d1-worker": { enabled: true, path: "workers/d1-worker" },
        "agent-worker": { enabled: true, path: "workers/agent-worker" },
        "trade-worker": { enabled: true, path: "workers/trade-worker" },
        "telegram-worker": { enabled: true, path: "workers/telegram-worker" },
      },
    };

    const customDomains = { "trade-worker": "trade.example.com" };
    const urlMap = buildUrlMap("myapp", config, customDomains);

    expect(urlMap.TRADE_SERVICE_URL).toBe("https://trade.example.com");
    expect(urlMap.D1_WORKER_URL).toBe("https://d1-worker.myapp.workers.dev");
  });

  it("should apply custom domain from workers.jsonc config", () => {
    const buildUrlMap = (command as any).buildUrlMap.bind(command);

    const config = {
      global: { cloudflare_account_id: "test", subdomain_prefix: "myapp" },
      workers: {
        "d1-worker": { enabled: true, path: "workers/d1-worker" },
        "agent-worker": { enabled: true, path: "workers/agent-worker", custom_domain: "agent.myapp.io" },
        "trade-worker": { enabled: true, path: "workers/trade-worker" },
        "telegram-worker": { enabled: true, path: "workers/telegram-worker" },
      },
    };

    const urlMap = buildUrlMap("myapp", config, {});

    expect(urlMap.AGENT_SERVICE_URL).toBe("https://agent.myapp.io");
    expect(urlMap.D1_WORKER_URL).toBe("https://d1-worker.myapp.workers.dev");
  });

  it("should prioritize CLI custom domain over workers.jsonc custom_domain", () => {
    const buildUrlMap = (command as any).buildUrlMap.bind(command);

    const config = {
      global: { cloudflare_account_id: "test", subdomain_prefix: "myapp" },
      workers: {
        "d1-worker": { enabled: true, path: "workers/d1-worker" },
        "agent-worker": { enabled: true, path: "workers/agent-worker", custom_domain: "agent.myapp.io" },
        "trade-worker": { enabled: true, path: "workers/trade-worker" },
        "telegram-worker": { enabled: true, path: "workers/telegram-worker" },
      },
    };

    // CLI override should take precedence over config custom_domain
    const customDomains = { "agent-worker": "agent.override.com" };
    const urlMap = buildUrlMap("myapp", config, customDomains);

    expect(urlMap.AGENT_SERVICE_URL).toBe("https://agent.override.com");
  });

  it("should compute changes correctly", () => {
    const computeChanges = (command as any).computeChanges.bind(command);

    const currentVars = {
      D1_WORKER_URL: "https://d1-worker.old.workers.dev",
      AGENT_SERVICE_URL: "https://agent-worker.old.workers.dev",
      TRADE_SERVICE_URL: "https://trade-worker.old.workers.dev",
      TELEGRAM_SERVICE_URL: "https://telegram-worker.old.workers.dev",
    };

    const urlMap = {
      D1_WORKER_URL: "https://d1-worker.cryptolinx.workers.dev",
      AGENT_SERVICE_URL: "https://agent-worker.cryptolinx.workers.dev",
      TRADE_SERVICE_URL: "https://trade-worker.cryptolinx.workers.dev",
      TELEGRAM_SERVICE_URL: "https://telegram-worker.cryptolinx.workers.dev",
    };

    const changes = computeChanges(currentVars, urlMap);

    expect(changes).toHaveLength(4);
    expect(changes[0]).toEqual({
      key: "D1_WORKER_URL",
      oldValue: "https://d1-worker.old.workers.dev",
      newValue: "https://d1-worker.cryptolinx.workers.dev",
    });
  });

  it("should detect no changes when URLs match", () => {
    const computeChanges = (command as any).computeChanges.bind(command);

    const currentVars = {
      D1_WORKER_URL: "https://d1-worker.cryptolinx.workers.dev",
      AGENT_SERVICE_URL: "https://agent-worker.cryptolinx.workers.dev",
    };

    const urlMap = {
      D1_WORKER_URL: "https://d1-worker.cryptolinx.workers.dev",
      AGENT_SERVICE_URL: "https://agent-worker.cryptolinx.workers.dev",
    };

    const changes = computeChanges(currentVars, urlMap);
    expect(changes).toHaveLength(0);
  });

  it("should detect new keys not in current vars", () => {
    const computeChanges = (command as any).computeChanges.bind(command);

    const currentVars = {
      D1_WORKER_URL: "https://d1-worker.cryptolinx.workers.dev",
    };

    const urlMap = {
      D1_WORKER_URL: "https://d1-worker.cryptolinx.workers.dev",
      AGENT_SERVICE_URL: "https://agent-worker.cryptolinx.workers.dev",
    };

    const changes = computeChanges(currentVars, urlMap);
    expect(changes).toHaveLength(1);
    expect(changes[0].key).toBe("AGENT_SERVICE_URL");
    expect(changes[0].oldValue).toBe("");
  });

  it("should parse custom-domain arg correctly", () => {
    const parseArg = (command as any).parseCustomDomainArg.bind(command);

    expect(parseArg(undefined)).toEqual({});
    expect(parseArg("trade-worker=trade.example.com")).toEqual({
      "trade-worker": "trade.example.com",
    });
    expect(
      parseArg("trade-worker=trade.example.com,agent-worker=agent.example.com"),
    ).toEqual({
      "trade-worker": "trade.example.com",
      "agent-worker": "agent.example.com",
    });
  });

  it("should apply changes to wrangler.jsonc preserving JSONC formatting", () => {
    const originalContent = `{
  "name": "hoox-dashboard",
  "vars": {
    "D1_WORKER_URL": "https://old.workers.dev"
  }
}`;

    const changes = [
      { key: "D1_WORKER_URL", newValue: "https://d1-worker.cryptolinx.workers.dev" },
    ];

    // Use jsonc-parser modify + applyEdits directly
    let editedContent = originalContent;
    for (const change of changes) {
      const edits = modify(editedContent, ["vars", change.key], change.newValue, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      });
      editedContent = applyEdits(editedContent, edits);
    }

    const parsed = parse(editedContent) as any;
    expect(parsed.vars.D1_WORKER_URL).toBe("https://d1-worker.cryptolinx.workers.dev");
    // Verify JSONC formatting is preserved (comments, etc.)
    expect(editedContent).toContain('"name": "hoox-dashboard"');
  });

  it("should apply multiple changes preserving JSONC structure", () => {
    const originalContent = `{
  // Dashboard config
  "name": "hoox-dashboard",
  "vars": {
    "D1_WORKER_URL": "https://d1-worker.old.workers.dev",
    "AGENT_SERVICE_URL": "https://agent-worker.old.workers.dev"
  }
}`;

    const changes = [
      { key: "D1_WORKER_URL", newValue: "https://d1-worker.cryptolinx.workers.dev" },
      { key: "AGENT_SERVICE_URL", newValue: "https://agent-worker.cryptolinx.workers.dev" },
    ];

    let editedContent = originalContent;
    for (const change of changes) {
      const edits = modify(editedContent, ["vars", change.key], change.newValue, {
        formattingOptions: { insertSpaces: true, tabSize: 2 },
      });
      editedContent = applyEdits(editedContent, edits);
    }

    const parsed = parse(editedContent) as any;
    expect(parsed.vars.D1_WORKER_URL).toBe("https://d1-worker.cryptolinx.workers.dev");
    expect(parsed.vars.AGENT_SERVICE_URL).toBe("https://agent-worker.cryptolinx.workers.dev");
    // Verify comment is preserved
    expect(editedContent).toContain("// Dashboard config");
  });

  it("should read workers.jsonc correctly", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), WORKERS_JSONC);

    const readWorkersConfig = (command as any).readWorkersConfig.bind(command);
    const config = await readWorkersConfig(`${tmpDir}/workers.jsonc`);

    expect(config.global.subdomain_prefix).toBe("cryptolinx");
    expect(config.workers["d1-worker"]).toBeDefined();
    expect(config.workers["agent-worker"]).toBeDefined();
  });

  it("should throw CLIError when workers.jsonc is missing", async () => {
    const readWorkersConfig = (command as any).readWorkersConfig.bind(command);

    try {
      await readWorkersConfig(`${tmpDir}/nonexistent.jsonc`);
      expect.unreachable("Should have thrown");
    } catch (error: any) {
      expect(error.code).toBe("CONFIG_NOT_FOUND");
    }
  });

  it("should read dashboard wrangler.jsonc correctly", async () => {
    writeFileSync(
      join(tmpDir, "pages", "dashboard", "wrangler.jsonc"),
      DASHBOARD_WRANGLER,
    );

    const readWranglerConfig = (command as any).readWranglerConfig.bind(command);
    const content = await readWranglerConfig(
      `${tmpDir}/pages/dashboard/wrangler.jsonc`,
    );

    expect(content).toContain("hoox-dashboard");
    expect(content).toContain("D1_WORKER_URL");
  });

  it("should throw CLIError when dashboard wrangler.jsonc is missing", async () => {
    const readWranglerConfig = (command as any).readWranglerConfig.bind(command);

    try {
      await readWranglerConfig(`${tmpDir}/nonexistent.jsonc`);
      expect.unreachable("Should have thrown");
    } catch (error: any) {
      expect(error.code).toBe("WRANGLER_NOT_FOUND");
    }
  });

  it("should run in dry-run mode without writing changes", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), WORKERS_JSONC);
    writeFileSync(
      join(tmpDir, "pages", "dashboard", "wrangler.jsonc"),
      DASHBOARD_WRANGLER,
    );

    mockCtx.args = { "dry-run": true };

    await command.execute(mockCtx);

    // Verify the file was NOT modified
    const content = await Bun.file(
      join(tmpDir, "pages", "dashboard", "wrangler.jsonc"),
    ).text();
    expect(content).toContain("old-prefix");
    expect(content).not.toContain("cryptolinx");
  });

  it("should emit command:start on execute", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), WORKERS_JSONC);
    writeFileSync(
      join(tmpDir, "pages", "dashboard", "wrangler.jsonc"),
      DASHBOARD_WRANGLER,
    );

    // Use dry-run to avoid interactive prompt
    mockCtx.args = { "dry-run": true };

    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "workers:update-internal-urls" }),
    );
  });

  it("should set error state when workers.jsonc is missing", async () => {
    // No workers.jsonc created
    mockCtx.args = { "dry-run": true };

    await command.execute(mockCtx);

    expect(mockCtx.observer.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "error" }),
    );
  });

  it("should set success state when URLs are already up to date", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), WORKERS_JSONC);
    writeFileSync(
      join(tmpDir, "pages", "dashboard", "wrangler.jsonc"),
      DASHBOARD_WRANGLER_UP_TO_DATE,
    );

    await command.execute(mockCtx);

    expect(mockCtx.observer.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "success" }),
    );
  });
});