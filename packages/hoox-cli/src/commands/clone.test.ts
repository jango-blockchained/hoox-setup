import { describe, it, expect, beforeEach, mock } from "bun:test";
import { CloneCommand } from "./clone.js";
import type { CommandContext } from "../../core/types.js";

// Mock @clack/prompts
mock.module("@clack/prompts", () => ({
  intro: mock(() => {}),
  outro: mock(() => {}),
  spinner: mock(() => ({
    start: mock(() => {}),
    stop: mock(() => {}),
  })),
  log: {
    step: mock(() => {}),
    error: mock(() => {}),
    success: mock(() => {}),
  },
  text: mock(() => Promise.resolve("/default/destination")),
  isCancel: mock(() => false),
  cancel: mock(() => {}),
}));

describe("CloneCommand", () => {
  let command: CloneCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new CloneCommand();
    mockCtx = {
      observer: {
        emit: mock(() => {}),
        setState: mock(() => {}),
      } as any,
      engine: {} as any,
      adapters: {
        cloudflare: { deployWorker: mock(async () => {}) } as any,
        bun: {} as any,
        workers: {} as any,
      },
      cwd: "/test",
      args: {},
    };
  });

  it("should have correct name", () => {
    expect(command.name).toBe("clone");
  });

  it("should have correct description", () => {
    expect(command.description).toBe("Clone the hoox-setup repository");
  });

  it("should have destination option with correct properties", () => {
    expect(command.options).toBeDefined();
    expect(command.options).toHaveLength(1);
    expect(command.options?.[0].flag).toBe("destination");
    expect(command.options?.[0].short).toBe("d");
    expect(command.options?.[0].type).toBe("string");
    expect(command.options?.[0].description).toBe("Clone destination");
  });

  it("should have execute method", () => {
    expect(typeof command.execute).toBe("function");
  });

  it("should emit command:start event on execute", async () => {
    await command.execute(mockCtx);
    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "clone" })
    );
  });

  it("should call setState with success on successful execution", async () => {
    await command.execute(mockCtx);
    expect(mockCtx.observer.setState).toHaveBeenCalledWith({ commandStatus: "success" });
  });

  it("should have options array matching expected structure", () => {
    expect(command.options?.[0]).toEqual(
      expect.objectContaining({
        flag: "destination",
        short: "d",
        type: "string",
        description: "Clone destination",
      })
    );
  });
});
