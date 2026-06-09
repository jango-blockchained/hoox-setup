import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { DockerService } from "./docker-service.js";

// ---------------------------------------------------------------------------
// Helpers — following cloudflare-service.test.ts patterns
// ---------------------------------------------------------------------------

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

function successSpawn(stdout: string): MockSpawnResult {
  return makeSpawnResult(stdout, "", 0);
}

function errorSpawn(stderr: string, exitCode = 1): MockSpawnResult {
  return makeSpawnResult("", stderr, exitCode);
}

let lastSpawnCmd: string[] = [];
let lastSpawnEnv: Record<string, string> | undefined;

function mockSpawnWithCapture(result: MockSpawnResult): void {
  const _spawnMock = mock(
    (
      cmd: string[],
      options?: { cwd?: string; env?: Record<string, string> }
    ) => {
      lastSpawnCmd = cmd;
      lastSpawnEnv = options?.env;
      return result;
    }
  );
  (Bun as unknown as Record<string, unknown>).spawn = _spawnMock;
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  lastSpawnCmd = [];
  lastSpawnEnv = undefined;
});

afterEach(() => {
  (Bun as unknown as Record<string, unknown>).spawn = realSpawn;
  mock.restore();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("DockerService", () => {
  // -- Constructor ----------------------------------------------------------

  it("defaults cwd to process.cwd()", () => {
    const service = new DockerService();
    expect(service).toBeDefined();
  });

  it("accepts a custom cwd", () => {
    const service = new DockerService("/custom/path");
    expect(service).toBeDefined();
  });

  // -- checkAvailability ----------------------------------------------------

  describe("checkAvailability", () => {
    it("returns both true when docker and compose are available", async () => {
      mockSpawnWithCapture(successSpawn("/usr/bin/docker"));

      const service = new DockerService();
      const result = await service.checkAvailability();

      expect(result.docker).toBe(true);
      expect(result.compose).toBe(true);
      // The new implementation spawns `which` and (for "docker compose")
      // additionally spawns `docker compose version` to probe the subcommand.
      // We don't assert on lastSpawnCmd here because the Promise.all ordering
      // makes the final captured call non-deterministic.
    });

    it("returns both false when docker is not available", async () => {
      mockSpawnWithCapture(errorSpawn("not found"));

      const service = new DockerService();
      const result = await service.checkAvailability();

      expect(result.docker).toBe(false);
      expect(result.compose).toBe(false);
    });

    it("returns false when Bun.spawn fails in isCommandAvailable", async () => {
      const spawnMock = mock(() => {
        throw new Error("ENOENT: docker not found");
      });
      (Bun as unknown as Record<string, unknown>).spawn = spawnMock;

      const service = new DockerService();

      // isCommandAvailable now wraps Bun.spawn in try/catch, so a synchronous
      // throw (e.g. when `which` is missing on minimal Alpine) resolves to
      // false rather than rejecting the overall checkAvailability call.
      const result = await service.checkAvailability();
      expect(result).toEqual({ docker: false, compose: false });
    });
  });

  // -- composeFileExists ----------------------------------------------------

  describe("composeFileExists", () => {
    it("returns true when docker-compose.yml exists", async () => {
      const mockFile = {
        exists: mock(() => Promise.resolve(true)),
      };
      const realFile = Bun.file;
      (Bun as unknown as Record<string, unknown>).file = mock(() => mockFile);

      const service = new DockerService("/project");
      const result = await service.composeFileExists();

      expect(result).toBe(true);
      expect(mockFile.exists).toHaveBeenCalled();

      (Bun as unknown as Record<string, unknown>).file = realFile;
    });

    it("returns false when docker-compose.yml does not exist", async () => {
      const mockFile = {
        exists: mock(() => Promise.resolve(false)),
      };
      const realFile = Bun.file;
      (Bun as unknown as Record<string, unknown>).file = mock(() => mockFile);

      const service = new DockerService("/project");
      const result = await service.composeFileExists();

      expect(result).toBe(false);

      (Bun as unknown as Record<string, unknown>).file = realFile;
    });

    it("handles cwd with trailing slash", async () => {
      const mockFile = {
        exists: mock(() => Promise.resolve(true)),
      };
      const realFile = Bun.file;
      const fileMock = mock((path: string) => {
        expect(path).toBe("/project/docker-compose.yml");
        return mockFile;
      });
      (Bun as unknown as Record<string, unknown>).file = fileMock;

      const service = new DockerService("/project/");
      const result = await service.composeFileExists();

      expect(result).toBe(true);

      (Bun as unknown as Record<string, unknown>).file = realFile;
    });
  });

  // -- composeUp ------------------------------------------------------------

  describe("composeUp", () => {
    it("returns ok on successful non-detached compose up", async () => {
      mockSpawnWithCapture(makeSpawnResult("", "", 0));

      const service = new DockerService("/project");
      const result = await service.composeUp(["workers", "dashboard"]);

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual(["docker", "compose", "up"]);
      expect(lastSpawnEnv).toEqual({ COMPOSE_PROFILES: "workers,dashboard" });
    });

    it("returns error on non-zero exit in non-detached mode", async () => {
      mockSpawnWithCapture(errorSpawn("container crashed", 1));

      const service = new DockerService("/project");
      const result = await service.composeUp(["workers"]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("exited with code 1");
      }
    });

    it("passes -d flag in detached mode", async () => {
      const stdoutText = "Starting containers...";
      mockSpawnWithCapture(makeSpawnResult(stdoutText, "", 0));

      const service = new DockerService("/project");
      const result = await service.composeUp(["workers"], true);

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toContain("-d");
    });

    it("returns error from stdout in detached mode on failure", async () => {
      mockSpawnWithCapture(makeSpawnResult("Error: port in use", "", 1));

      const service = new DockerService("/project");
      const result = await service.composeUp(["workers"], true);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("Error: port in use");
      }
    });

    it("falls back to exit code message when stdout is empty in detached mode", async () => {
      mockSpawnWithCapture(makeSpawnResult("", "", 1));

      const service = new DockerService("/project");
      const result = await service.composeUp(["workers"], true);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("exited with code 1");
      }
    });

    it("returns error when Bun.spawn throws", async () => {
      const spawnMock = mock(() => {
        throw new Error("docker not found");
      });
      (Bun as unknown as Record<string, unknown>).spawn = spawnMock;

      const service = new DockerService("/project");
      const result = await service.composeUp(["workers"]);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Failed to run docker compose");
        expect(result.error).toContain("docker not found");
      }
    });
  });

  // -- composeDown ----------------------------------------------------------

  describe("composeDown", () => {
    it("returns ok on successful compose down", async () => {
      mockSpawnWithCapture(makeSpawnResult("", "", 0));

      const service = new DockerService("/project");
      const result = await service.composeDown();

      expect(result.ok).toBe(true);
      expect(lastSpawnCmd).toEqual(["docker", "compose", "down"]);
    });

    it("returns error on non-zero exit", async () => {
      mockSpawnWithCapture(makeSpawnResult("", "no containers to stop", 1));

      const service = new DockerService("/project");
      const result = await service.composeDown();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toBe("no containers to stop");
      }
    });

    it("falls back to exit code message when stderr is empty", async () => {
      mockSpawnWithCapture(makeSpawnResult("", "", 1));

      const service = new DockerService("/project");
      const result = await service.composeDown();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("exited with code 1");
      }
    });

    it("returns error when Bun.spawn throws", async () => {
      const spawnMock = mock(() => {
        throw new Error("docker not found");
      });
      (Bun as unknown as Record<string, unknown>).spawn = spawnMock;

      const service = new DockerService("/project");
      const result = await service.composeDown();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toContain("Failed to run docker compose down");
      }
    });
  });
});
