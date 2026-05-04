import { describe, it, expect, beforeEach, mock } from "bun:test";
import { WorkersDevCommand } from "./dev.js";
import type { CommandContext } from "../../core/types.js";

describe("WorkersDevCommand", () => {
  let command: WorkersDevCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new WorkersDevCommand();
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
        cloudflare: {} as any,
        bun: {} as any,
        workers: {} as any,
      },
      cwd: "/test",
    };
  });

  it("should have correct name and description", () => {
    expect(command.name).toBe("workers:dev");
    expect(command.description).toBe("Start local Wrangler dev server");
  });

  it("should have worker option", () => {
    expect(command.options).toBeDefined();
    const workerOption = command.options?.find((o) => o.flag === "worker");
    expect(workerOption).toBeDefined();
    expect(workerOption?.type).toBe("string");
  });

  it("should emit command:start on execute", async () => {
    // Mock Bun.spawn for wrangler dev
    const mockSpawn = mock(() => ({
      exited: new Promise(() => {}), // Never exits (dev server)
      stdout: new Blob([]),
      stderr: new Blob([]),
      kill: mock(() => {}),
    }));
    (Bun as any).spawn = mockSpawn;

    // Run execute - it will start dev server
    const executePromise = command.execute(mockCtx);

    // Give it a moment to emit
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "workers:dev" })
    );

    // Clean up - in real implementation, we'd handle SIGINT
    (Bun as any).spawn = Bun.spawn;
  });
});
