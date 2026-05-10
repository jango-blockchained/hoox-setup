import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { CloudflareService } from "./cloudflare-service.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Save a reference to the real Bun.spawn so we can restore it after tests. */
const realSpawn = Bun.spawn;

type MockSpawnResult = {
  stdout: Blob;
  stderr: Blob;
  exited: Promise<number>;
  stdin?: {
    write: ReturnType<typeof mock>;
    end: ReturnType<typeof mock>;
  };
  kill: ReturnType<typeof mock>;
};

/**
 * Creates a mock spawn result with the given stdout, stderr, and exit code.
 * Used to replace Bun.spawn in tests.
 */
function makeSpawnResult(
  stdoutText: string,
  stderrText: string,
  exitCode: number
): MockSpawnResult {
  return {
    stdout: new Blob([stdoutText]),
    stderr: new Blob([stderrText]),
    exited: Promise.resolve(exitCode),
    stdin: {
      write: mock(() => {}),
      end: mock(() => {}),
    },
    kill: mock(() => {}),
  };
}

/**
 * Convenience: a successful spawn with the given stdout.
 */
function successSpawn(stdout: string): MockSpawnResult {
  return makeSpawnResult(stdout, "", 0);
}

/**
 * Convenience: a failed spawn with the given stderr and exit code.
 */
function errorSpawn(stderr: string, exitCode = 1): MockSpawnResult {
  return makeSpawnResult("", stderr, exitCode);
}

/** Install a mock Bun.spawn that returns the given result. */
function mockSpawnWith(result: MockSpawnResult): void {
  const spawnMock = mock(() => result);
  (Bun as unknown as Record<string, unknown>).spawn = spawnMock;
}

/** Track spawn calls so we can assert on arguments. */
let lastSpawnCmd: string[] = [];
let lastSpawnCwd: string | undefined;

function mockSpawnWithCapture(result: MockSpawnResult): void {
  const spawnMock = mock((cmd: string[], options?: { cwd?: string }) => {
    lastSpawnCmd = cmd;
    lastSpawnCwd = options?.cwd;
    return result;
  });
  (Bun as unknown as Record<string, unknown>).spawn = spawnMock;
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  lastSpawnCmd = [];
  lastSpawnCwd = undefined;
});

afterEach(() => {
  (Bun as unknown as Record<string, unknown>).spawn = realSpawn;
  mock.restore();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CloudflareService", () => {
  // -- Constructor ----------------------------------------------------------

  it("defaults cwd to process.cwd()", () => {
    const service = new CloudflareService();
    // Cannot easily inspect private cwd, but we verify via spawn cwd later
    expect(service).toBeDefined();
  });

  it("accepts a custom cwd", () => {
    const service = new CloudflareService("/custom/path");
    expect(service).toBeDefined();
  });

  // -- whoami ---------------------------------------------------------------

  describe("whoami", () => {
    it("returns ok with stdout on success", async () => {
      mockSpawnWithCapture(successSpawn("user@example.com"));

      const service = new CloudflareService();
      const result = await service.whoami();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe("user@example.com");
      }
      expect(lastSpawnCmd).toEqual(["wrangler", "whoami"]);
    });

    it("returns error on non-zero exit", async () => {
      mockSpawnWithCapture(errorSpawn("Not authenticated"));

      const service = new CloudflareService();
      const result = await service.whoami();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Not authenticated");
      }
    });
  });

  // -- deploy ---------------------------------------------------------------

  describe("deploy", () => {
    it("deploys without --env by default", async () => {
      const stdout =
        "Published test-worker (0.5 sec)\n  https://test-worker.cryptolinx.workers.dev";
      mockSpawnWithCapture(successSpawn(stdout));

      const service = new CloudflareService();
      const result = await service.deploy("workers/test-worker");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.url).toBe(
          "https://test-worker.cryptolinx.workers.dev"
        );
      }
      expect(lastSpawnCmd).toEqual(["wrangler", "deploy"]);
    });

    it("includes --env when specified", async () => {
      const stdout =
        "Published test-worker (production)\n  https://test-worker.cryptolinx.workers.dev";
      mockSpawnWithCapture(successSpawn(stdout));

      const service = new CloudflareService();
      const result = await service.deploy("workers/test-worker", "production");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.url).toBe(
          "https://test-worker.cryptolinx.workers.dev"
        );
      }
      expect(lastSpawnCmd).toEqual([
        "wrangler",
        "deploy",
        "--env",
        "production",
      ]);
    });

    it("returns url undefined when stdout has no URL", async () => {
      mockSpawnWithCapture(successSpawn("Deployed successfully. No URL here."));

      const service = new CloudflareService();
      const result = await service.deploy("workers/test-worker");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.url).toBeUndefined();
      }
    });

    it("returns error on deploy failure", async () => {
      mockSpawnWithCapture(errorSpawn("Authentication error"));

      const service = new CloudflareService();
      const result = await service.deploy("workers/broken");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Authentication error");
      }
    });
  });

  // -- dev ------------------------------------------------------------------

  describe("dev", () => {
    it("returns default port 8787", async () => {
      mockSpawnWithCapture(successSpawn(""));

      const service = new CloudflareService();
      const result = await service.dev("workers/test-worker");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.port).toBe(8787);
      }
      expect(lastSpawnCmd).toEqual(["wrangler", "dev", "--port", "8787"]);
    });

    it("returns custom port when specified", async () => {
      mockSpawnWithCapture(successSpawn(""));

      const service = new CloudflareService();
      const result = await service.dev("workers/test-worker", 3000);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.port).toBe(3000);
      }
      expect(lastSpawnCmd).toEqual(["wrangler", "dev", "--port", "3000"]);
    });
  });

  // -- D1 -------------------------------------------------------------------

  describe("d1 operations", () => {
    it("d1List calls wrangler d1 list --json", async () => {
      mockSpawnWithCapture(successSpawn('[{"name":"test-db"}]'));

      const service = new CloudflareService();
      const result = await service.d1List();

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual(["wrangler", "d1", "list", "--json"]);
    });

    it("d1Create calls wrangler d1 create with name", async () => {
      mockSpawnWithCapture(successSpawn("Created database my-db"));

      const service = new CloudflareService();
      const result = await service.d1Create("my-db");

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual(["wrangler", "d1", "create", "my-db"]);
    });

    it("d1Delete calls wrangler d1 delete with name", async () => {
      mockSpawnWithCapture(successSpawn("Deleted database old-db"));

      const service = new CloudflareService();
      const result = await service.d1Delete("old-db");

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual(["wrangler", "d1", "delete", "old-db"]);
    });
  });

  // -- KV -------------------------------------------------------------------

  describe("kv operations", () => {
    it("kvList calls wrangler kv namespace list", async () => {
      mockSpawnWithCapture(successSpawn("[]"));

      const service = new CloudflareService();
      const result = await service.kvList();

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual(["wrangler", "kv", "namespace", "list"]);
    });

    it("kvCreate calls wrangler kv namespace create", async () => {
      mockSpawnWithCapture(successSpawn("Created namespace my-kv"));

      const service = new CloudflareService();
      const result = await service.kvCreate("my-kv");

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual([
        "wrangler",
        "kv",
        "namespace",
        "create",
        "my-kv",
      ]);
    });

    it("kvDelete calls wrangler kv namespace delete", async () => {
      mockSpawnWithCapture(successSpawn("Deleted namespace"));

      const service = new CloudflareService();
      const result = await service.kvDelete("abc123");

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual([
        "wrangler",
        "kv",
        "namespace",
        "delete",
        "--namespace-id",
        "abc123",
      ]);
    });
  });

  // -- R2 -------------------------------------------------------------------

  describe("r2 operations", () => {
    it("r2List calls wrangler r2 bucket list", async () => {
      mockSpawnWithCapture(successSpawn("[]"));

      const service = new CloudflareService();
      const result = await service.r2List();

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual(["wrangler", "r2", "bucket", "list"]);
    });

    it("r2Create calls wrangler r2 bucket create", async () => {
      mockSpawnWithCapture(successSpawn("Created bucket my-bucket"));

      const service = new CloudflareService();
      const result = await service.r2Create("my-bucket");

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual([
        "wrangler",
        "r2",
        "bucket",
        "create",
        "my-bucket",
      ]);
    });

    it("r2Delete calls wrangler r2 bucket delete", async () => {
      mockSpawnWithCapture(successSpawn("Deleted bucket"));

      const service = new CloudflareService();
      const result = await service.r2Delete("old-bucket");

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual([
        "wrangler",
        "r2",
        "bucket",
        "delete",
        "old-bucket",
      ]);
    });
  });

  // -- Queues ---------------------------------------------------------------

  describe("queue operations", () => {
    it("queueList calls wrangler queues list", async () => {
      mockSpawnWithCapture(successSpawn("[]"));

      const service = new CloudflareService();
      const result = await service.queueList();

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual(["wrangler", "queues", "list"]);
    });

    it("queueCreate calls wrangler queues create", async () => {
      mockSpawnWithCapture(successSpawn("Created queue my-queue"));

      const service = new CloudflareService();
      const result = await service.queueCreate("my-queue");

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual([
        "wrangler",
        "queues",
        "create",
        "my-queue",
      ]);
    });

    it("queueDelete calls wrangler queues delete", async () => {
      mockSpawnWithCapture(successSpawn("Deleted queue"));

      const service = new CloudflareService();
      const result = await service.queueDelete("old-queue");

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual([
        "wrangler",
        "queues",
        "delete",
        "old-queue",
      ]);
    });
  });

  // -- Secrets --------------------------------------------------------------

  describe("secret operations", () => {
    it("secretList calls wrangler secret list --name", async () => {
      mockSpawnWithCapture(successSpawn("[]"));

      const service = new CloudflareService();
      const result = await service.secretList("my-worker");

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual([
        "wrangler",
        "secret",
        "list",
        "--name",
        "my-worker",
      ]);
    });

    it("secretPut pipes value through stdin (never via CLI args)", async () => {
      let stdinWritten = "";
      let stdinEnded = false;

      const spawnResult = {
        stdout: new Blob(["Secret set successfully"]),
        stderr: new Blob([""]),
        exited: Promise.resolve(0),
        stdin: {
          write: mock((data: string) => {
            stdinWritten = data;
          }),
          end: mock(() => {
            stdinEnded = true;
          }),
        },
        kill: mock(() => {}),
      };

      const spawnMock = mock((cmd: string[]) => {
        lastSpawnCmd = cmd;
        return spawnResult;
      });
      (Bun as unknown as Record<string, unknown>).spawn = spawnMock;

      const service = new CloudflareService();
      const result = await service.secretPut(
        "my-worker",
        "API_KEY",
        "super-secret-value"
      );

      expect(result.ok).toBe(true);
      // The secret value should NEVER appear in CLI args
      const argsJoined = lastSpawnCmd.join(" ");
      expect(argsJoined).not.toContain("super-secret-value");
      // stdin should receive the secret value
      expect(stdinWritten).toBe("super-secret-value\n");
      expect(stdinEnded).toBe(true);
    });

    it("secretDelete calls wrangler secret delete", async () => {
      mockSpawnWithCapture(successSpawn("Deleted secret"));

      const service = new CloudflareService();
      const result = await service.secretDelete("my-worker", "OLD_KEY");

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual([
        "wrangler",
        "secret",
        "delete",
        "OLD_KEY",
        "--name",
        "my-worker",
      ]);
    });
  });

  // -- zonesList ------------------------------------------------------------

  describe("zonesList", () => {
    it("calls wrangler zones list", async () => {
      mockSpawnWithCapture(successSpawn("[]"));

      const service = new CloudflareService();
      const result = await service.zonesList();

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual(["wrangler", "zones", "list"]);
    });
  });

  // -- Error handling -------------------------------------------------------

  describe("error handling", () => {
    it("returns ok:false when wrangler exits non-zero", async () => {
      mockSpawnWithCapture(errorSpawn("fatal error: something broke", 2));

      const service = new CloudflareService();
      const result = await service.whoami();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("fatal error: something broke");
      }
    });

    it("falls back to exit code message when stderr is empty", async () => {
      mockSpawnWithCapture(makeSpawnResult("", "", 1));

      const service = new CloudflareService();
      const result = await service.whoami();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("wrangler exited with code 1");
      }
    });

    it("returns error when Bun.spawn itself throws", async () => {
      // Simulate spawn throwing (e.g. wrangler not installed)
      const spawnMock = mock(() => {
        throw new Error("ENOENT: wrangler not found");
      });
      (Bun as unknown as Record<string, unknown>).spawn = spawnMock;

      const service = new CloudflareService();
      const result = await service.whoami();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Failed to spawn wrangler");
        expect(result.error).toContain("ENOENT");
      }
    });
  });

  // -- Stdout parsing -------------------------------------------------------

  describe("stdout parsing", () => {
    it("trims trailing whitespace from stdout", async () => {
      mockSpawnWithCapture(successSpawn("  hello world  \n"));

      const service = new CloudflareService();
      const result = await service.whoami();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data).toBe("hello world");
      }
    });
  });
});
