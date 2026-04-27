import { describe, expect, test, beforeEach, vi, Mock } from "bun:test";
import * as workerCommands from "../src/workerCommands.js";
import * as utils from "../src/utils.js";
import * as configUtils from "../src/configUtils.js";

vi.mock("../src/utils.js", () => ({
  runCommandAsync: vi.fn(),
  runInteractiveCommand: vi.fn(),
  getCloudflareToken: vi.fn(),
  print_success: vi.fn(),
  print_error: vi.fn(),
  print_warning: vi.fn(),
  red: (s: string) => s,
  green: (s: string) => s,
  yellow: (s: string) => s,
  blue: (s: string) => s,
  cyan: (s: string) => s,
  dim: (s: string) => s,
  rl: { question: vi.fn() },
}));

vi.mock("../src/configUtils.js", () => ({
  saveConfig: vi.fn(),
  stringifyToml: vi.fn(),
}));

describe("workerCommands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.exitCode = 0;
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Export Validation", () => {
    test("should export setupWorkers function", () => {
      expect(workerCommands.setupWorkers).toBeDefined();
      expect(typeof workerCommands.setupWorkers).toBe("function");
    });

    test("should export deployWorkers function", () => {
      expect(workerCommands.deployWorkers).toBeDefined();
      expect(typeof workerCommands.deployWorkers).toBe("function");
    });

    test("should export deployPages function", () => {
      expect(workerCommands.deployPages).toBeDefined();
      expect(typeof workerCommands.deployPages).toBe("function");
    });

    test("should export startDevServer function", () => {
      expect(workerCommands.startDevServer).toBeDefined();
      expect(typeof workerCommands.startDevServer).toBe("function");
    });

    test("should export displayStatus function", () => {
      expect(workerCommands.displayStatus).toBeDefined();
      expect(typeof workerCommands.displayStatus).toBe("function");
    });

    test("should export runTests function", () => {
      expect(workerCommands.runTests).toBeDefined();
      expect(typeof workerCommands.runTests).toBe("function");
    });

    test("should export updateInternalUrls function", () => {
      expect(workerCommands.updateInternalUrls).toBeDefined();
      expect(typeof workerCommands.updateInternalUrls).toBe("function");
    });

    test("should export printAvailableWorkers function", () => {
      expect(workerCommands.printAvailableWorkers).toBeDefined();
      expect(typeof workerCommands.printAvailableWorkers).toBe("function");
    });

    test("should export cloneWorkerRepositories function", () => {
      expect(workerCommands.cloneWorkerRepositories).toBeDefined();
      expect(typeof workerCommands.cloneWorkerRepositories).toBe("function");
    });

    test("should export checkSecretBindings function", () => {
      expect(workerCommands.checkSecretBindings).toBeDefined();
      expect(typeof workerCommands.checkSecretBindings).toBe("function");
    });
  });

  describe("setupWorkers", () => {
    test("should exit early when secret store id is missing", async () => {
      const config = {
        global: {
          cloudflare_api_token: "test-token",
          cloudflare_account_id: "test-account",
          cloudflare_secret_store_id: "",
        },
        workers: {},
      } as any;

      await workerCommands.setupWorkers(config);

      expect(utils.print_error).toHaveBeenCalled();
    });

    test("should skip disabled workers", async () => {
      const getTokenMock = utils.getCloudflareToken as Mock<typeof utils.getCloudflareToken>;
      getTokenMock.mockResolvedValueOnce("test-token");

      const config = {
        global: {
          cloudflare_api_token: "test-token",
          cloudflare_account_id: "test-account",
          cloudflare_secret_store_id: "test-store",
        },
        workers: {
          "disabled-worker": {
            enabled: false,
            path: "workers/disabled",
          },
        },
      } as any;

      vi.spyOn(process, "cwd").mockReturnValueOnce("/tmp");

      await workerCommands.setupWorkers(config);

      expect(utils.print_warning).toHaveBeenCalled();
    });
  });

  describe("deployWorkers", () => {
    test("should exit early when API token is missing", async () => {
      const getTokenMock = utils.getCloudflareToken as Mock<typeof utils.getCloudflareToken>;
      getTokenMock.mockResolvedValueOnce("");

      const config = {
        global: {
          cloudflare_account_id: "test-account",
        },
        workers: {},
      } as any;

      await workerCommands.deployWorkers(config);

      expect(process.exitCode).toBe(1);
    });

    test("should skip disabled workers", async () => {
      const getTokenMock = utils.getCloudflareToken as Mock<typeof utils.getCloudflareToken>;
      getTokenMock.mockResolvedValueOnce("test-token");

      const config = {
        global: {
          cloudflare_api_token: "test-token",
          cloudflare_account_id: "test-account",
        },
        workers: {
          "disabled-worker": {
            enabled: false,
            path: "workers/disabled",
          },
        },
      } as any;

      vi.spyOn(process, "cwd").mockReturnValueOnce("/tmp");

      await workerCommands.deployWorkers(config);

      expect(utils.print_warning).toHaveBeenCalled();
    });
  });

  describe("updateInternalUrls", () => {
    test("should handle empty workers config", async () => {
      const config = {
        global: { subdomain_prefix: "test" },
        workers: {},
      } as any;

      await workerCommands.updateInternalUrls(config);

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("displayStatus", () => {
    test("should handle empty config", async () => {
      const config = {
        global: { subdomain_prefix: "test" },
        workers: {},
      } as any;

      await workerCommands.displayStatus(config);

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("printAvailableWorkers", () => {
    test("should print workers with enabled status", () => {
      const config = {
        global: { subdomain_prefix: "test" },
        workers: {
          "test-worker": { enabled: true, path: "workers/test" },
          "disabled-worker": { enabled: false, path: "workers/disabled" },
        },
      } as any;

      workerCommands.printAvailableWorkers(config);

      expect(console.log).toHaveBeenCalled();
    });

    test("should handle empty workers", () => {
      const config = {
        global: { subdomain_prefix: "test" },
        workers: {},
      } as any;

      workerCommands.printAvailableWorkers(config);

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("runTests", () => {
    test("should handle empty config", async () => {
      const config = {
        global: { subdomain_prefix: "test" },
        workers: {},
      } as any;

      vi.spyOn(process, "cwd").mockReturnValueOnce("/tmp");

      await workerCommands.runTests(config, "test-worker", false);

      expect(console.log).toHaveBeenCalled();
    });
  });

  describe("startDevServer", () => {
    test("should handle empty config", async () => {
      const config = {
        global: { subdomain_prefix: "test" },
        workers: {},
      } as any;

      vi.spyOn(process, "cwd").mockReturnValueOnce("/tmp");

      await workerCommands.startDevServer(config, "test-worker", false, false);

      expect(console.log).toHaveBeenCalled();
    });
  });
});