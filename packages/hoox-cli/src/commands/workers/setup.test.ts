import { describe, it, expect, beforeEach, mock } from "bun:test";
import { WorkersSetupCommand } from "./setup.js";
import type { CommandContext } from "../../core/types.js";

describe("WorkersSetupCommand", () => {
  let command: WorkersSetupCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new WorkersSetupCommand();
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
          testConnection: mock(async () => true),
        } as any,
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
    expect(command.name).toBe("workers:setup");
    expect(command.description).toBe("Bind secrets and provision environment");
  });

  it("should have worker option", () => {
    expect(command.options).toBeDefined();
    const workerOption = command.options?.find((o) => o.flag === "worker");
    expect(workerOption).toBeDefined();
    expect(workerOption?.type).toBe("string");
  });

  it("should emit command:start on execute", async () => {
    // Mock the setup logic to avoid actual operations
    const originalSpawn = Bun.spawn;
    (Bun as any).spawn = mock(() => ({
      exited: Promise.resolve(0),
      stdout: new Blob([]),
      stderr: new Blob([]),
    }));

    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "workers:setup" })
    );

    (Bun as any).spawn = originalSpawn;
  });
});
