import { describe, it, expect, beforeEach, mock } from "bun:test";
import type { CommandContext, Observer } from "../../core/types.js";

// Mock KV data store
const kvStore = new Map<string, string>();

const mockGetKVValue = mock((namespaceId: string, key: string) => {
  const fullKey = `${namespaceId}:${key}`;
  return Promise.resolve(kvStore.get(fullKey) ?? null);
});

const mockPutKVValue = mock((namespaceId: string, key: string, value: string) => {
  const fullKey = `${namespaceId}:${key}`;
  kvStore.set(fullKey, value);
  return Promise.resolve();
});

const mockListKVNamespaces = mock(() =>
  Promise.resolve([{ id: "ns-config-kv", title: "CONFIG_KV" }])
);

mock.module("../../adapters/cloudflare.js", () => {
  return {
    CloudflareAdapter: mock(() => ({
      listKVNamespaces: mockListKVNamespaces,
      getKVValue: mockGetKVValue,
      putKVValue: mockPutKVValue,
    })),
  };
});

mock.module("@clack/prompts", () => {
  return {
    intro: mock(() => {}),
    outro: mock(() => {}),
    select: mock(() => Promise.resolve("view")),
    confirm: mock(() => Promise.resolve(true)),
    text: mock(() => Promise.resolve("10")),
    spinner: mock(() => ({
      start: mock(() => {}),
      stop: mock(() => {}),
    })),
    isCancel: mock(() => false),
    cancel: mock(() => {}),
    log: {
      success: mock(() => {}),
      error: mock(() => {}),
      info: mock(() => {}),
      step: mock(() => {}),
      message: mock(() => {}),
      warn: mock(() => {}),
    },
  };
});

mock.module("ansis", () => {
  const handler = {
    get(_target: unknown, prop: string) {
      if (prop === "default") return handler;
      return (str: string) => str;
    },
  };
  const proxy = new Proxy({}, handler);
  return { default: proxy };
});

describe("WafCommand", () => {
  let WafCommand: new () => {
    name: string;
    description: string;
    options: Array<{ flag: string; short?: string; type: string; description?: string }>;
    execute: (ctx: CommandContext) => Promise<void>;
  };
  let mockObserver: Observer;
  let mockContext: CommandContext;

  beforeEach(async () => {
    // Reset KV store and mocks
    kvStore.clear();
    mockListKVNamespaces.mockImplementation(() =>
      Promise.resolve([{ id: "ns-config-kv", title: "CONFIG_KV" }])
    );
    mockGetKVValue.mockImplementation((namespaceId: string, key: string) => {
      const fullKey = `${namespaceId}:${key}`;
      return Promise.resolve(kvStore.get(fullKey) ?? null);
    });
    mockPutKVValue.mockImplementation((namespaceId: string, key: string, value: string) => {
      const fullKey = `${namespaceId}:${key}`;
      kvStore.set(fullKey, value);
      return Promise.resolve();
    });

    const module = await import("./index.js");
    WafCommand = module.default;

    mockObserver = {
      emit: mock(() => {}),
      on: mock(() => () => {}),
      subscribe: mock(() => () => {}),
      getState: mock(() => ({ commandStatus: "idle" })),
      setState: mock(() => {}),
    } as unknown as Observer;

    mockContext = {
      observer: mockObserver,
      engine: {} as any,
      adapters: {
        cloudflare: {
          listKVNamespaces: mockListKVNamespaces,
          getKVValue: mockGetKVValue,
          putKVValue: mockPutKVValue,
        } as any,
        bun: {} as any,
        workers: {} as any,
      },
      cwd: "/test",
    } as CommandContext;
  });

  it("should have correct name", () => {
    const cmd = new WafCommand();
    expect(cmd.name).toBe("waf");
  });

  it("should have description", () => {
    const cmd = new WafCommand();
    expect(cmd.description).toBeDefined();
    expect(cmd.description.length).toBeGreaterThan(0);
  });

  it("should define --ips and --mode options", () => {
    const cmd = new WafCommand();
    expect(cmd.options).toBeDefined();
    const flags = cmd.options!.map((o) => o.flag);
    expect(flags).toContain("ips");
    expect(flags).toContain("mode");
  });

  it("should emit command:start event on execute", async () => {
    const cmd = new WafCommand();
    mockContext.args = {};
    await cmd.execute(mockContext);
    expect(mockObserver.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "waf" })
    );
  });

  it("should set commandStatus to success on successful execution", async () => {
    const cmd = new WafCommand();
    mockContext.args = {};
    await cmd.execute(mockContext);
    expect(mockObserver.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "success" })
    );
  });

  it("should set commandStatus to error on failure", async () => {
    mockListKVNamespaces.mockImplementation(() => {
      throw new Error("API error");
    });

    const cmd = new WafCommand();
    mockContext.args = {};
    await cmd.execute(mockContext);

    expect(mockObserver.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "error" })
    );
  });

  it("should reject invalid mode flag", async () => {
    const cmd = new WafCommand();
    mockContext.args = { mode: "invalid" };
    await cmd.execute(mockContext);

    expect(mockObserver.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "error" })
    );
  });

  it("should reject invalid IP format in --ips flag", async () => {
    const cmd = new WafCommand();
    mockContext.args = { ips: "not-an-ip,999.999.999.999" };
    await cmd.execute(mockContext);

    expect(mockObserver.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "error" })
    );
  });

  it("should apply --mode flag directly", async () => {
    const cmd = new WafCommand();
    mockContext.args = { mode: "challenge" };
    await cmd.execute(mockContext);

    expect(mockPutKVValue).toHaveBeenCalledWith(
      "ns-config-kv",
      "waf_rules",
      expect.stringContaining('"mode": "challenge"')
    );
  });

  it("should apply --ips flag directly", async () => {
    const cmd = new WafCommand();
    mockContext.args = { ips: "1.2.3.4,10.0.0.0/24" };
    await cmd.execute(mockContext);

    expect(mockPutKVValue).toHaveBeenCalledWith(
      "ns-config-kv",
      "waf_rules",
      expect.stringContaining("1.2.3.4")
    );
    expect(mockPutKVValue).toHaveBeenCalledWith(
      "ns-config-kv",
      "waf_rules",
      expect.stringContaining("10.0.0.0/24")
    );
  });

  it("should accept valid IPv4 addresses", async () => {
    const cmd = new WafCommand();
    mockContext.args = { ips: "192.168.1.1,10.0.0.1" };
    await cmd.execute(mockContext);

    expect(mockObserver.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "success" })
    );
  });

  it("should accept valid IPv4 with CIDR notation", async () => {
    const cmd = new WafCommand();
    mockContext.args = { ips: "10.0.0.0/8,172.16.0.0/12" };
    await cmd.execute(mockContext);

    expect(mockObserver.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "success" })
    );
  });

  it("should throw CLIError when CONFIG_KV namespace not found", async () => {
    mockListKVNamespaces.mockImplementation(() => Promise.resolve([]));

    const cmd = new WafCommand();
    mockContext.args = { mode: "block" };
    await cmd.execute(mockContext);

    expect(mockObserver.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "error" })
    );
  });

  it("should load default rules when KV is empty", async () => {
    mockGetKVValue.mockImplementation(() => Promise.resolve(null));

    const cmd = new WafCommand();
    mockContext.args = { mode: "simulate" };
    await cmd.execute(mockContext);

    // Should save with default IPs (empty) and the new mode
    expect(mockPutKVValue).toHaveBeenCalledWith(
      "ns-config-kv",
      "waf_rules",
      expect.stringContaining('"mode": "simulate"')
    );
  });

  it("should handle malformed KV data gracefully", async () => {
    mockGetKVValue.mockImplementation(() => Promise.resolve("not-json"));

    const cmd = new WafCommand();
    mockContext.args = { mode: "block" };
    await cmd.execute(mockContext);

    // Should still succeed by using defaults
    expect(mockObserver.setState).toHaveBeenCalledWith(
      expect.objectContaining({ commandStatus: "success" })
    );
  });
});