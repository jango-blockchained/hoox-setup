import { describe, it, expect, beforeEach, afterEach, mock } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { ConfigInitCommand } from "./init.js";
import type { CommandContext } from "../../core/types.js";

describe("ConfigInitCommand", () => {
  let command: ConfigInitCommand;
  let mockCtx: CommandContext;
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "hoox-init-test-"));
    command = new ConfigInitCommand();

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
        cloudflare: {
          testConnection: mock(async () => true),
        } as any,
        bun: {
          readFile: mock(async (path: string) => {
            return Bun.file(path).text();
          }),
          writeFile: mock(async (path: string, content: string) => {
            await Bun.write(path, content);
          }),
          loadEnv: mock(() => ({})),
          promptSecret: mock(async () => "test-value"),
        } as any,
        workers: {} as any,
      },
      cwd: tmpDir,
    };
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should have correct name and description", () => {
    expect(command.name).toBe("config:init");
    expect(command.description).toBe("Initialize Hoox configuration");
  });

  it("should have token option", () => {
    const tokenOption = command.options?.find((o) => o.flag === "token");
    expect(tokenOption).toBeDefined();
    expect(tokenOption?.type).toBe("string");
    expect(tokenOption?.short).toBe("t");
  });

  it("should have account option", () => {
    const accountOption = command.options?.find((o) => o.flag === "account");
    expect(accountOption).toBeDefined();
    expect(accountOption?.type).toBe("string");
    expect(accountOption?.short).toBe("a");
  });

  it("should have secret-store option", () => {
    const secretStoreOption = command.options?.find(
      (o) => o.flag === "secret-store"
    );
    expect(secretStoreOption).toBeDefined();
    expect(secretStoreOption?.type).toBe("string");
    expect(secretStoreOption?.short).toBe("s");
  });

  it("should have prefix option", () => {
    const prefixOption = command.options?.find((o) => o.flag === "prefix");
    expect(prefixOption).toBeDefined();
    expect(prefixOption?.type).toBe("string");
    expect(prefixOption?.short).toBe("p");
  });

  it("should have force option", () => {
    const forceOption = command.options?.find((o) => o.flag === "force");
    expect(forceOption).toBeDefined();
    expect(forceOption?.type).toBe("boolean");
    expect(forceOption?.short).toBe("f");
  });

  it("should emit command:start on execute", async () => {
    mockCtx.args = {
      token: "test-token",
      account: "test-account",
      secretStore: "test-store",
      prefix: "test-prefix",
      force: true,
    };

    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "config:init" })
    );
  });

  it("should set commandStatus to success on successful execution", async () => {
    mockCtx.args = {
      token: "test-token",
      account: "test-account",
      secretStore: "test-store",
      prefix: "test-prefix",
      force: true,
    };

    await command.execute(mockCtx);

    expect(mockCtx.observer.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "success" })
    );
  });

  it("should create .env.local with provided values", async () => {
    writeFileSync(
      join(tmpDir, ".env.example"),
      `CLOUDFLARE_API_TOKEN="your_cloudflare_api_token"\nCLOUDFLARE_ACCOUNT_ID="your_cloudflare_account_id"\nCLOUDFLARE_SECRET_STORE_ID="your_secret_store_id"\nSUBDOMAIN_PREFIX="hoox"\n`
    );

    mockCtx.args = {
      token: "my-api-token",
      account: "my-account-id",
      secretStore: "my-store-id",
      prefix: "myapp",
      force: true,
    };

    await command.execute(mockCtx);

    const envLocalPath = join(tmpDir, ".env.local");
    expect(existsSync(envLocalPath)).toBe(true);

    const content = readFileSync(envLocalPath, "utf-8");
    expect(content).toContain('CLOUDFLARE_API_TOKEN="my-api-token"');
    expect(content).toContain('CLOUDFLARE_ACCOUNT_ID="my-account-id"');
    expect(content).toContain('CLOUDFLARE_SECRET_STORE_ID="my-store-id"');
    expect(content).toContain('SUBDOMAIN_PREFIX="myapp"');
  });

  it("should create workers.jsonc with global config", async () => {
    mockCtx.args = {
      token: "test-token",
      account: "my-account-id",
      secretStore: "my-store-id",
      prefix: "myapp",
      force: true,
    };

    await command.execute(mockCtx);

    const workersJsoncPath = join(tmpDir, "workers.jsonc");
    expect(existsSync(workersJsoncPath)).toBe(true);

    const content = JSON.parse(readFileSync(workersJsoncPath, "utf-8"));
    expect(content.global.cloudflare_account_id).toBe("my-account-id");
    expect(content.global.cloudflare_secret_store_id).toBe("my-store-id");
    expect(content.global.subdomain_prefix).toBe("myapp");
    expect(content.global.cloudflare_api_token).toBe(
      "<USE_WRANGLER_SECRET_PUT>"
    );
  });

  it("should update existing workers.jsonc preserving workers section", async () => {
    const existingConfig = {
      global: {
        cloudflare_api_token: "old-token",
        cloudflare_account_id: "old-account",
      },
      workers: {
        hoox: { enabled: true, path: "workers/hoox" },
      },
    };
    writeFileSync(
      join(tmpDir, "workers.jsonc"),
      JSON.stringify(existingConfig, null, 2)
    );

    mockCtx.args = {
      token: "test-token",
      account: "new-account-id",
      secretStore: "new-store-id",
      prefix: "newprefix",
      force: true,
    };

    await command.execute(mockCtx);

    const content = JSON.parse(
      readFileSync(join(tmpDir, "workers.jsonc"), "utf-8")
    );
    expect(content.global.cloudflare_account_id).toBe("new-account-id");
    expect(content.global.cloudflare_secret_store_id).toBe("new-store-id");
    expect(content.global.subdomain_prefix).toBe("newprefix");
    // Workers section should be preserved
    expect(content.workers.hoox).toBeDefined();
    expect(content.workers.hoox.enabled).toBe(true);
  });

  it("should validate API token via cloudflare adapter", async () => {
    mockCtx.args = {
      token: "valid-token",
      account: "test-account",
      secretStore: "test-store",
      prefix: "test-prefix",
      force: true,
    };

    await command.execute(mockCtx);

    expect(mockCtx.adapters.cloudflare.testConnection).toHaveBeenCalled();
  });

  it("should set error state when token validation fails", async () => {
    (mockCtx.adapters.cloudflare.testConnection as ReturnType<typeof mock>).mockImplementation(
      async () => false
    );

    mockCtx.args = {
      token: "invalid-token",
      account: "test-account",
      secretStore: "test-store",
      prefix: "test-prefix",
      force: true,
    };

    await command.execute(mockCtx);

    expect(mockCtx.observer.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "error" })
    );
  });

  it("should not create files when token validation fails", async () => {
    (mockCtx.adapters.cloudflare.testConnection as ReturnType<typeof mock>).mockImplementation(
      async () => false
    );

    mockCtx.args = {
      token: "invalid-token",
      account: "test-account",
      secretStore: "test-store",
      prefix: "test-prefix",
      force: true,
    };

    await command.execute(mockCtx);

    expect(existsSync(join(tmpDir, ".env.local"))).toBe(false);
    expect(existsSync(join(tmpDir, "workers.jsonc"))).toBe(false);
  });

  it("should create minimal .env.local when no .env.example exists", async () => {
    // No .env.example file created
    mockCtx.args = {
      token: "test-token",
      account: "test-account",
      secretStore: "test-store",
      prefix: "test-prefix",
      force: true,
    };

    await command.execute(mockCtx);

    const envLocalPath = join(tmpDir, ".env.local");
    expect(existsSync(envLocalPath)).toBe(true);

    const content = readFileSync(envLocalPath, "utf-8");
    expect(content).toContain("CLOUDFLARE_API_TOKEN");
    expect(content).toContain("CLOUDFLARE_ACCOUNT_ID");
  });

  it("should mask API token in summary output", () => {
    // Access private method via any for testing
    const cmd = command as any;
    expect(cmd.maskToken("short")).toBe("****");
    // 8-char tokens are too short to show first/last 4 safely
    expect(cmd.maskToken("12345678")).toBe("****");
    // Longer tokens show first 4, masked middle, last 4
    expect(cmd.maskToken("12345678901234")).toBe("1234******1234");
    expect(cmd.maskToken("abcdefghijklmnopqrstuvwxyz")).toBe(
      "abcd******************wxyz"
    );
  });

  it("should handle errors gracefully", async () => {
    (mockCtx.adapters.bun.writeFile as ReturnType<typeof mock>).mockImplementation(
      async () => {
        throw new Error("Write failed");
      }
    );

    mockCtx.args = {
      token: "test-token",
      account: "test-account",
      secretStore: "test-store",
      prefix: "test-prefix",
      force: true,
    };

    await command.execute(mockCtx);

    expect(mockCtx.observer.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "error" })
    );
  });
});