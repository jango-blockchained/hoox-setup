import { describe, it, expect, beforeEach, mock } from "bun:test";
import { WorkersMetricsCommand } from "./metrics.js";
import type { CommandContext } from "../../core/types.js";

describe("WorkersMetricsCommand", () => {
  let command: WorkersMetricsCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new WorkersMetricsCommand();
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
    expect(command.name).toBe("workers:metrics");
    expect(command.description).toBe("Show worker metrics and analytics");
  });

  it("should have worker option", () => {
    expect(command.options).toBeDefined();
    const workerOption = command.options?.find(o => o.flag === "worker");
    expect(workerOption).toBeDefined();
    expect(workerOption?.type).toBe("string");
  });

  it("should have all option", () => {
    const allOption = command.options?.find(o => o.flag === "all");
    expect(allOption).toBeDefined();
    expect(allOption?.type).toBe("boolean");
  });

  it("should emit command:start on execute", async () => {
    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "workers:metrics" })
    );
  });
});
