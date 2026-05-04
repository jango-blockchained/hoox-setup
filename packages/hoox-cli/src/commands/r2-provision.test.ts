import { describe, it, expect, beforeEach, mock } from "bun:test";
import { R2ProvisionCommand } from "./r2-provision.js";
import type { CommandContext } from "../../core/types.js";

describe("R2ProvisionCommand", () => {
  let command: R2ProvisionCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new R2ProvisionCommand();
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
      args: {},
    };
  });

  it("should have correct name", () => {
    expect(command.name).toBe("r2-provision");
  });

  it("should have correct description", () => {
    expect(command.description).toBe("Provision required R2 buckets");
  });

  it("should have execute method", () => {
    expect(typeof command.execute).toBe("function");
  });

  it("should emit command:start on execute", async () => {
    // Mock Bun.spawn
    const mockSpawn = mock(() => ({
      exited: Promise.resolve(0),
      stdout: new Blob([""]),
      stderr: new Blob([""]),
    }));
    (Bun as any).spawn = mockSpawn;

    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "r2-provision" })
    );

    (Bun as any).spawn = Bun.spawn;
  });

  it("should use Bun.spawn instead of child_process", async () => {
    let spawnCalled = false;
    const mockSpawn = mock(() => {
      spawnCalled = true;
      return {
        exited: Promise.resolve(0),
        stdout: new Blob([""]),
        stderr: new Blob([""]),
      };
    });
    (Bun as any).spawn = mockSpawn;

    await command.execute(mockCtx);

    expect(spawnCalled).toBe(true);

    (Bun as any).spawn = Bun.spawn;
  });
});
