/**
 * CliBridge Tests — Binary resolution, exec, non-zero exit, abort/timeout.
 *
 * Uses real Bun.spawn for end-to-end tests and mocks for timeout/abort.
 */
import { describe, it, expect, mock, beforeAll, afterAll } from "bun:test";
import { cliBridge } from "./cli-bridge";
import type { CliResult } from "../types";

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("CliBridge", () => {
  afterAll(() => {
    cliBridge.dispose();
  });

  describe("resolveBinary", () => {
    it("resolves to a valid file path", async () => {
      const binary = await cliBridge.resolveBinary();
      expect(binary).toBeTruthy();
      expect(typeof binary).toBe("string");
      expect(binary.length).toBeGreaterThan(0);
    });

    it("resolved path points to an existing file", async () => {
      const binary = await cliBridge.resolveBinary();
      const exists = await Bun.file(binary).exists();
      expect(exists).toBe(true);
    });

    it("uses cached binary path on subsequent calls", async () => {
      cliBridge.invalidateCache();
      const first = await cliBridge.resolveBinary();
      const second = await cliBridge.resolveBinary();
      expect(second).toBe(first);
    });
  });

  describe("exec", () => {
    it("returns a properly shaped CliResult on success", async () => {
      const result = await cliBridge.exec(["--help"], { timeout: 10_000 });

      expect(result).toBeDefined();
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("exitCode");
      expect(result).toHaveProperty("stdout");
      expect(result).toHaveProperty("stderr");
      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("duration");

      expect(typeof result.success).toBe("boolean");
      expect(typeof result.exitCode).toBe("number");
      expect(typeof result.stdout).toBe("string");
      expect(typeof result.stderr).toBe("string");
      expect(typeof result.duration).toBe("number");

      expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it("includes stdout and stderr as strings", async () => {
      const result = await cliBridge.exec(["--help"], { timeout: 10_000 });
      expect(typeof result.stdout).toBe("string");
      expect(typeof result.stderr).toBe("string");
    });

    it("does not parse JSON when --json flag is not used", async () => {
      const result = await cliBridge.exec(["--help"], { timeout: 10_000 });
      expect(result.data).toBeNull();
    });

    it("sets data to null on non-zero exit even with --json flag", async () => {
      const result = await cliBridge.exec(["nonexistent-command"], {
        json: true,
        timeout: 5_000,
      });
      expect(result.success).toBe(false);
      expect(result.data).toBeNull();
    });
  });

  describe("non-zero exit codes", () => {
    it("captures non-zero exit code from failed command", async () => {
      const result = await cliBridge.exec(["nonexistent-command"], {
        timeout: 5_000,
      });
      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
    });

    it("includes stderr content on failure", async () => {
      const result = await cliBridge.exec(["nonexistent-command"], {
        timeout: 5_000,
      });
      expect(result.success).toBe(false);
      expect(typeof result.stderr).toBe("string");
    });
  });

  describe("abort and timeout", () => {
    const originalSpawn = Bun.spawn;

    beforeAll(() => {
      const neverResolve = new Promise<number>(() => {});

      Bun.spawn = mock(
        (
          _cmd: string[],
          opts?: { signal?: AbortSignal }
        ): {
          stdout: ReadableStream<Uint8Array>;
          stderr: ReadableStream<Uint8Array>;
          exited: Promise<number>;
          kill: (code?: number) => void;
        } => {
          const signal = opts?.signal;

          const exited = new Promise<number>((resolve) => {
            if (signal?.aborted) {
              resolve(-1);
            } else {
              signal?.addEventListener("abort", () => resolve(-1), {
                once: true,
              });
            }
          });

          const makeStream = () =>
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.close();
              },
            });

          return {
            stdout: makeStream(),
            stderr: makeStream(),
            exited,
            kill: mock(() => {}),
          };
        }
      ) as unknown as typeof Bun.spawn;
    });

    afterAll(() => {
      Bun.spawn = originalSpawn;
      cliBridge.invalidateCache();
    });

    it("abort cancels a running command and returns error result", async () => {
      const tag = "test:abort";
      const promise = cliBridge.exec(["mock-cmd"], { tag, timeout: 60_000 });

      cliBridge.abort(tag);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(-1);
      expect(result.stdout).toBe("");
    });

    it("abort is a no-op for unknown tags", () => {
      expect(() => cliBridge.abort("nonexistent")).not.toThrow();
    });

    it("dispose cancels all active commands", async () => {
      const p1 = cliBridge.exec(["cmd-a"], {
        tag: "ta",
        timeout: 60_000,
      });
      const p2 = cliBridge.exec(["cmd-b"], {
        tag: "tb",
        timeout: 60_000,
      });

      cliBridge.dispose();

      const [r1, r2] = await Promise.all([p1, p2]);
      expect(r1.success).toBe(false);
      expect(r1.exitCode).toBe(-1);
      expect(r2.success).toBe(false);
      expect(r2.exitCode).toBe(-1);
    });

    it("timeout returns error result", async () => {
      const tag = "test:timeout";
      const promise = cliBridge.exec(["mock-cmd"], {
        tag,
        timeout: 1,
      });

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(-1);
    });
  });

  describe("convenience methods API", () => {
    it("has all convenience methods defined", () => {
      expect(typeof cliBridge.deployAll).toBe("function");
      expect(typeof cliBridge.deployWorker).toBe("function");
      expect(typeof cliBridge.checkHealth).toBe("function");
      expect(typeof cliBridge.workerLogs).toBe("function");
      expect(typeof cliBridge.configShow).toBe("function");
      expect(typeof cliBridge.configValidate).toBe("function");
      expect(typeof cliBridge.monitorStatus).toBe("function");
      expect(typeof cliBridge.rebuild).toBe("function");
      expect(typeof cliBridge.repairWorker).toBe("function");
      expect(typeof cliBridge.checkSetup).toBe("function");
    });
  });
});
