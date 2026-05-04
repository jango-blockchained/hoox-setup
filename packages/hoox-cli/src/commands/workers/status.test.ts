import { describe, it, expect, beforeEach, mock } from "bun:test";
import { WorkersStatusCommand } from "./status.js";
import type { CommandContext } from "../../core/types.js";

describe("WorkersStatusCommand", () => {
  let command: WorkersStatusCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new WorkersStatusCommand();
    mockCtx = {
      observer: {
        emit: mock(() => {}),
        getState: mock(() => ({
          workers: {
            "trade-worker": { name: "trade-worker", status: "healthy" },
            hoox: { name: "hoox", status: "healthy" },
          },
        })),
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
    expect(command.name).toBe("workers:status");
    expect(command.description).toBe("Launch TUI for monitoring");
  });

  it("should emit command:start on execute", async () => {
    // Mock the TUI launch to avoid actual TUI
    const { spawn } = Bun;
    (Bun as any).spawn = mock(() => ({
      exited: Promise.resolve(0),
    }));

    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "workers:status" })
    );

    (Bun as any).spawn = spawn;
  });
});
