import { describe, it, expect, beforeEach, mock } from "bun:test";
import { WorkersTestCommand } from "./test.js";
import type { CommandContext } from "../../core/types.js";

describe("WorkersTestCommand", () => {
  let command: WorkersTestCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new WorkersTestCommand();
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
        cloudflare: {},
        bun: {},
        workers: {},
      } as any,
      cwd: "/test",
    };
  });

  it("should have correct name and description", () => {
    expect(command.name).toBe("workers:test");
    expect(command.description).toBe("Run Vitest integration suite");
  });

  it("should have worker option", () => {
    expect(command.options).toBeDefined();
    const workerOption = command.options?.find(o => o.flag === "worker");
    expect(workerOption).toBeDefined();
    expect(workerOption?.type).toBe("string");
  });

  it("should have coverage option", () => {
    const coverageOption = command.options?.find(o => o.flag === "coverage");
    expect(coverageOption).toBeDefined();
    expect(coverageOption?.type).toBe("boolean");
  });

  it("should emit command:start on execute", async () => {
    // Mock Bun.spawn for vitest
    const mockSpawn = mock(() => ({
      exited: Promise.resolve(0),
      stdout: new Blob([]),
      stderr: new Blob([]),
    }));
    (Bun as any).spawn = mockSpawn;

    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "workers:test" })
    );

    (Bun as any).spawn = Bun.spawn;
  });
});
