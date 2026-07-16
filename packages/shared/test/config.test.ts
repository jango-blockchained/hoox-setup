/**
 * Unit tests for config validation and read
 * Run with: bun test packages/shared/test/config.test.ts
 */

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";
import { validateConfig, readConfigSync } from "../src/config";

describe("validateConfig", () => {
  test("returns empty array for valid config", () => {
    const errors = validateConfig({
      apiUrl: "https://api.example.com",
      refreshIntervalMs: 500,
      theme: "dark",
    });
    expect(errors).toEqual([]);
  });

  test("returns empty array for empty partial config", () => {
    expect(validateConfig({})).toEqual([]);
  });

  test("returns error when apiUrl missing http prefix", () => {
    const errors = validateConfig({ apiUrl: "ftp://example.com" });
    expect(errors).toContain("apiUrl must start with http:// or https://");
  });

  test("accepts apiUrl starting with https://", () => {
    const errors = validateConfig({ apiUrl: "https://localhost:8787" });
    expect(errors).toHaveLength(0);
  });

  test("accepts apiUrl starting with http://", () => {
    const errors = validateConfig({ apiUrl: "http://localhost:8787" });
    expect(errors).toHaveLength(0);
  });

  test("returns error when refreshIntervalMs < 100", () => {
    const errors = validateConfig({ refreshIntervalMs: 50 });
    expect(errors).toContain("refreshIntervalMs must be >= 100ms");
  });

  test("returns error when refreshIntervalMs is negative", () => {
    const errors = validateConfig({ refreshIntervalMs: -1 });
    expect(errors).toContain("refreshIntervalMs must be >= 100ms");
  });

  test("accepts refreshIntervalMs of exactly 100", () => {
    const errors = validateConfig({ refreshIntervalMs: 100 });
    expect(errors).toHaveLength(0);
  });

  test("accepts refreshIntervalMs of 500", () => {
    const errors = validateConfig({ refreshIntervalMs: 500 });
    expect(errors).toHaveLength(0);
  });

  test("returns error for invalid theme value", () => {
    const errors = validateConfig({ theme: "blue" as "dark" | "light" });
    expect(errors).toContain('theme must be "dark" or "light"');
  });

  test("accepts theme 'dark'", () => {
    expect(validateConfig({ theme: "dark" })).toHaveLength(0);
  });

  test("accepts theme 'light'", () => {
    expect(validateConfig({ theme: "light" })).toHaveLength(0);
  });

  test("returns multiple errors when multiple fields invalid", () => {
    const errors = validateConfig({
      apiUrl: "ftp://bad",
      refreshIntervalMs: 50,
      theme: "blue" as "dark" | "light",
    });
    expect(errors).toHaveLength(3);
  });

  test("only checks apiUrl when provided", () => {
    expect(validateConfig({ apiUrl: "" })).toHaveLength(0);
  });
});

describe("readConfigSync", () => {
  const ORIGINAL_API_URL = process.env.HOOX_API_URL;
  const ORIGINAL_API_TOKEN = process.env.HOOX_API_TOKEN;

  beforeEach(() => {
    delete process.env.HOOX_API_URL;
    delete process.env.HOOX_API_TOKEN;
  });

  afterEach(() => {
    if (ORIGINAL_API_URL !== undefined)
      process.env.HOOX_API_URL = ORIGINAL_API_URL;
    if (ORIGINAL_API_TOKEN !== undefined)
      process.env.HOOX_API_TOKEN = ORIGINAL_API_TOKEN;
  });

  test("returns default config when config file does not exist", () => {
    const config = readConfigSync();
    expect(config.apiUrl).toBe("http://localhost:8787");
    expect(config.refreshIntervalMs).toBe(500);
    expect(config.theme).toBe("dark");
    expect(config.defaultView).toBe("dashboard");
  });

  test("reads apiUrl from HOOX_API_URL environment variable", () => {
    process.env.HOOX_API_URL = "https://custom.api.com";
    const config = readConfigSync();
    expect(config.apiUrl).toBe("https://custom.api.com");
  });

  test("reads apiToken from HOOX_API_TOKEN environment variable", () => {
    process.env.HOOX_API_TOKEN = "my-secret-token";
    const config = readConfigSync();
    expect(config.apiToken).toBe("my-secret-token");
  });

  test("env vars override file config", () => {
    process.env.HOOX_API_URL = "https://env-override.com";
    const config = readConfigSync();
    expect(config.apiUrl).toBe("https://env-override.com");
  });
});

describe("readConfigSync / write with mocked fs (file paths)", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    delete process.env.HOOX_API_URL;
    delete process.env.HOOX_API_TOKEN;
  });

  afterEach(() => {
    process.env.HOOX_API_URL = ORIGINAL_ENV.HOOX_API_URL;
    process.env.HOOX_API_TOKEN = ORIGINAL_ENV.HOOX_API_TOKEN;
  });

  test("reads and merges config from existing file (via mock.module)", async () => {
    const fakeConfig = JSON.stringify({
      apiUrl: "https://fromfile.example.com",
      apiToken: "file-token",
      refreshIntervalMs: 1234,
      theme: "light",
    });

    const existsMock = mock(() => true);
    const readMock = mock(() => fakeConfig);
    const mkdirMock = mock(() => undefined);
    const writeMock = mock(() => undefined);

    mock.module("node:fs", () => ({
      existsSync: existsMock,
      readFileSync: readMock,
      writeFileSync: writeMock,
      mkdirSync: mkdirMock,
      // other fs used? not in this module
    }));

    // Re-import after mock to get instrumented bindings
    const { readConfigSync: readFresh } = await import("../src/config");

    const cfg = readFresh();
    expect(cfg.apiUrl).toBe("https://fromfile.example.com");
    expect(cfg.apiToken).toBe("file-token");
    expect(existsMock).toHaveBeenCalled();
  });

  test("falls back gracefully on bad JSON in config file", async () => {
    const existsMock = mock(() => true);
    const readMock = mock(() => "{not json at all");

    mock.module("node:fs", () => ({
      existsSync: existsMock,
      readFileSync: readMock,
      writeFileSync: mock(() => {}),
      mkdirSync: mock(() => {}),
    }));

    const { readConfigSync: readFresh } = await import("../src/config");
    const cfg = readFresh();
    expect(cfg.apiUrl).toBe("http://localhost:8787"); // defaulted
  });

  test("writeConfigSync ensures dir + writes file; catches errors", async () => {
    const consoleSpy = mock(() => {});
    const origConsole = console.error;
    console.error = consoleSpy;

    const existsMock = mock(() => false);
    const mkdirMock = mock(() => {});
    const writeMock = mock(() => {
      throw new Error("no space");
    });

    mock.module("node:fs", () => ({
      existsSync: existsMock,
      readFileSync: mock(() => "{}"),
      writeFileSync: writeMock,
      mkdirSync: mkdirMock,
    }));

    const { writeConfigSync: writeFresh } = await import("../src/config");

    const sample = {
      apiUrl: "http://x",
      apiToken: "",
      refreshIntervalMs: 500,
      theme: "dark" as const,
      activeExchanges: [],
      notifications: { alerts: true, trades: true, debug: false, system: true },
      soundEnabled: true,
      defaultView: "dashboard",
    } as any;

    writeFresh(sample);
    expect(mkdirMock).toHaveBeenCalled();
    expect(writeMock).toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalled(); // error path covered

    console.error = origConsole;
  });

  test("async readConfig and writeConfig work (delegation)", async () => {
    mock.module("node:fs", () => ({
      existsSync: () => false,
      readFileSync: () => "{}",
      writeFileSync: () => {},
      mkdirSync: () => {},
    }));

    const mod = await import("../src/config");
    const cfg = await mod.readConfig();
    expect(cfg).toHaveProperty("apiUrl");
    await mod.writeConfig(cfg); // should not throw
  });
});
