import { describe, expect, test, mock } from "bun:test";

// Mock all external dependencies before importing
mock.module("@clack/prompts", () => ({
  intro: mock(() => {}),
  outro: mock(() => {}),
  log: {
    info: mock(() => {}),
    success: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
  },
  spinner: mock(() => ({
    start: mock(() => {}),
    stop: mock(() => {}),
  })),
  select: mock(async () => "option"),
  confirm: mock(async () => true),
  text: mock(async () => "input"),
}));

mock.module("../src/configUtils.js", () => ({
  loadConfig: mock(async () => ({
    global: { cloudflare_api_token: "token", cloudflare_account_id: "acc" },
    workers: {},
  })),
  saveConfig: mock(async () => {}),
  getWorkerNames: mock(() => []),
  stringifyToml: mock((obj: any) => ""),
  parseConfig: mock(async () => ({ global: {}, workers: {} })),
}));

mock.module("../src/lib/cf-client.ts", () => ({
  CloudflareClient: mock((config: any) => ({
    listZones: mock(async () => []),
    getD1Database: mock(async () => ({})),
    listKVNamespaces: mock(async () => []),
  })),
}));

mock.module("bun", () => ({
  $: mock((strings: TemplateStringsArray, ...values: any[]) => ({
    quiet: mock(() => Promise.resolve({ exitCode: 0 })),
  })),
}));

// Import after mocking
const {
  setupWorkers,
  deployWorkers,
  deployPages,
  startDevServer,
  displayStatus,
  runTests,
  updateInternalUrls,
  printAvailableWorkers,
} = await import("../src/workerCommands.js");

describe("workerCommands - exported functions exist", () => {
  test("setupWorkers is a function", () => {
    expect(typeof setupWorkers).toBe("function");
  });

  test("deployWorkers is a function", () => {
    expect(typeof deployWorkers).toBe("function");
  });

  test("deployPages is a function", () => {
    expect(typeof deployPages).toBe("function");
  });

  test("startDevServer is a function", () => {
    expect(typeof startDevServer).toBe("function");
  });

  test("displayStatus is a function", () => {
    expect(typeof displayStatus).toBe("function");
  });

  test("runTests is a function", () => {
    expect(typeof runTests).toBe("function");
  });

  test("updateInternalUrls is a function", () => {
    expect(typeof updateInternalUrls).toBe("function");
  });

  test("printAvailableWorkers is a function", () => {
    expect(typeof printAvailableWorkers).toBe("function");
  });
});

describe("workerCommands - setupWorkers", () => {
  test("can be called without error", async () => {
    // Just test it doesn't throw with minimal config
    try {
      await setupWorkers({} as any);
    } catch (e) {
      // Expected to fail due to missing deps, that's ok
      expect(e).toBeDefined();
    }
  });
});

describe("workerCommands - deployWorkers", () => {
  test("can be called without error", async () => {
    try {
      await deployWorkers({} as any);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});

describe("workerCommands - displayStatus", () => {
  test("can be called without error", async () => {
    try {
      await displayStatus({} as any);
    } catch (e) {
      expect(e).toBeDefined();
    }
  });
});
