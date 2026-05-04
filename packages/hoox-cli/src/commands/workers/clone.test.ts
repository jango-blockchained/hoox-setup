import { describe, it, expect, beforeEach, mock } from "bun:test";
import { WorkersCloneCommand } from "./clone.js";
import type { CommandContext } from "../../core/types.js";

describe("WorkersCloneCommand", () => {
  let command: WorkersCloneCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new WorkersCloneCommand();
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
        bun: {
          readFile: mock(async () => "{}"),
          writeFile: mock(async () => {}),
        } as any,
        workers: {} as any,
      },
      cwd: "/test",
    };
  });

  it("should have correct name and description", () => {
    expect(command.name).toBe("workers:clone");
    expect(command.description).toBe("Clone worker repos as submodules");
  });

  it("should have directory option", () => {
    expect(command.options).toBeDefined();
    const dirOption = command.options?.find((o) => o.flag === "directory");
    expect(dirOption).toBeDefined();
    expect(dirOption?.type).toBe("string");
  });

  it("should emit command:start on execute", async () => {
    // Mock Bun.spawn to avoid actual git operations
    const originalSpawn = Bun.spawn;
    (Bun as any).spawn = mock(() => ({
      exited: Promise.resolve(0),
      stdout: new Blob([]),
      stderr: new Blob([]),
    }));

    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "workers:clone" })
    );

    (Bun as any).spawn = originalSpawn;
  });
});
