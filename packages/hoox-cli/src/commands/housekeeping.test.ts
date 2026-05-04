import { describe, it, expect, beforeEach, mock } from "bun:test";
import { HousekeepingCommand } from "./housekeeping.js";
import type { CommandContext } from "../../core/types.js";

describe("HousekeepingCommand", () => {
  let command: HousekeepingCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new HousekeepingCommand();
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
    expect(command.name).toBe("housekeeping");
  });

  it("should have correct description", () => {
    expect(command.description).toBe("Run system health checks");
  });

  it("should have execute method", () => {
    expect(typeof command.execute).toBe("function");
  });

  it("should emit command:start on execute", async () => {
    // Mock the runHousekeeping function
    const mockRunHousekeeping = mock(() => Promise.resolve());
    // We'll need to mock the import

    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "housekeeping" })
    );
  });

  it("should call setState with success on successful execution", async () => {
    await command.execute(mockCtx);
    expect(mockCtx.observer.setState).toHaveBeenCalledWith({ commandStatus: "success" });
  });
});
