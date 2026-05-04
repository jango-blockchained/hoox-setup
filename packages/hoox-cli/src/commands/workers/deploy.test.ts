import { describe, it, expect, beforeEach, mock } from "bun:test";
import { WorkersDeployCommand } from "./deploy.js";
import type { CommandContext } from "../../core/types.js";

describe("WorkersDeployCommand", () => {
  let command: WorkersDeployCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new WorkersDeployCommand();
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
          deployWorker: mock(async () => {}),
        } as any,
        bun: {} as any,
        workers: {} as any,
      },
      cwd: "/test",
    };
  });

  it("should have correct name and description", () => {
    expect(command.name).toBe("workers:deploy");
    expect(command.description).toBe("Deploy workers to Cloudflare");
  });

  it("should have force option", () => {
    expect(command.options).toBeDefined();
    const forceOption = command.options?.find((o) => o.flag === "force");
    expect(forceOption).toBeDefined();
    expect(forceOption?.type).toBe("boolean");
  });

  it("should emit command:start on execute", async () => {
    // Mock Bun.spawn for wrangler deploy
    const mockSpawn = mock(() => ({
      exited: Promise.resolve(0),
      stdout: new Blob(["https://worker.workers.dev"]),
      stderr: new Blob([]),
    }));
    (Bun as any).spawn = mockSpawn;

    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "workers:deploy" })
    );

    (Bun as any).spawn = Bun.spawn;
  });
});
