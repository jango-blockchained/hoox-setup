import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { RepairCommand } from "./index.js";
import type { CommandContext, CloudflareAdapter } from "../../core/types.js";

// ── Helpers ──────────────────────────────────────────────────────────

function createMockAdapter(overrides: Record<string, unknown> = {}): CloudflareAdapter {
  return {
    listD1Databases: async () => [],
    listKVNamespaces: async () => [],
    listR2Buckets: async () => [],
    listQueues: async () => [],
    listSecrets: async () => [],
    setSecret: async () => {},
    ...overrides,
  } as unknown as CloudflareAdapter;
}

function createMockContext(tmpDir: string, overrides: Record<string, unknown> = {}): CommandContext {
  return {
    cwd: tmpDir,
    adapters: {
      cloudflare: createMockAdapter(),
      bun: {
        readFile: async () => "",
        writeFile: async () => {},
        loadEnv: () => ({}),
        promptSecret: async () => "test-secret",
      },
      workers: {
        callServiceBinding: async () => ({ status: 200 }),
      },
    },
    observer: {
      getState: () => ({ commandStatus: {}, workers: {} }),
      setState: () => {},
      on: () => {},
      emit: () => {},
    },
    engine: {
      initialize: async () => {},
      startListening: () => {},
    },
    args: {},
    ...overrides,
  } as unknown as CommandContext;
}

// ── Tests ────────────────────────────────────────────────────────────

describe("repair command", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hoox-repair-test-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("has correct command metadata", () => {
    const command = new RepairCommand();
    expect(command.name).toBe("repair");
    expect(command.description).toBeDefined();
    expect(command.options).toBeDefined();
    expect(command.execute).toBeDefined();
  });

  it("creates .env.local from .env.example when available", async () => {
    // Create workers.jsonc
    writeFileSync(join(tmpDir, "workers.jsonc"), JSON.stringify({
      global: { cloudflare_account_id: "test", subdomain_prefix: "test" },
      workers: {},
    }));

    // Create .env.example
    writeFileSync(join(tmpDir, ".env.example"), "CLOUDFLARE_API_TOKEN=example\nCLOUDFLARE_ACCOUNT_ID=example\n");

    const ctx = createMockContext(tmpDir, { args: { force: true } });
    const command = new RepairCommand();
    await command.execute(ctx);

    // Verify .env.local was created
    const envLocal = Bun.file(join(tmpDir, ".env.local"));
    expect(await envLocal.exists()).toBe(true);
  });

  it("processes workers with secrets in force mode", async () => {
    // Create workers.jsonc with a worker that has secrets
    writeFileSync(join(tmpDir, "workers.jsonc"), JSON.stringify({
      global: { cloudflare_account_id: "test", subdomain_prefix: "test" },
      workers: {
        hoox: { enabled: true, path: "workers/hoox", secrets: ["WEBHOOK_API_KEY_BINDING"] },
      },
    }));

    // Create worker directory
    mkdirSync(join(tmpDir, "workers", "hoox"), { recursive: true });
    writeFileSync(join(tmpDir, "workers", "hoox", "wrangler.jsonc"), JSON.stringify({ name: "hoox" }));

    const ctx = createMockContext(tmpDir, { args: { force: true } });
    const command = new RepairCommand();
    // Should not throw - processes workers with secrets
    await command.execute(ctx);
  });

  it("handles force mode without prompts", async () => {
    writeFileSync(join(tmpDir, "workers.jsonc"), JSON.stringify({
      global: { cloudflare_account_id: "test", subdomain_prefix: "test" },
      workers: {},
    }));

    const ctx = createMockContext(tmpDir, { args: { force: true } });
    const command = new RepairCommand();
    // Should not throw
    await command.execute(ctx);
  });
});