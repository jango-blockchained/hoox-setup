import { describe, it, expect, beforeEach, mock } from "bun:test";
import { WorkersRollbackCommand } from "./rollback.js";
import type { CommandContext } from "../../core/types.js";

describe("WorkersRollbackCommand", () => {
  let command: WorkersRollbackCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new WorkersRollbackCommand();
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
    expect(command.name).toBe("workers:rollback");
    expect(command.description).toBe("Rollback worker to previous version");
  });

  it("should have worker option (required)", () => {
    expect(command.options).toBeDefined();
    const workerOption = command.options?.find(o => o.flag === "worker");
    expect(workerOption).toBeDefined();
    expect(workerOption?.type).toBe("string");
    expect(workerOption?.required).toBe(true);
  });

  it("should have version option", () => {
    const versionOption = command.options?.find(o => o.flag === "version");
    expect(versionOption).toBeDefined();
    expect(versionOption?.type).toBe("string");
  });

  it("should emit command:start on execute", async () => {
    // Mock the Cloudflare client methods
    const mockGetVersions = mock(async () => [
      { version: "v1", deployed_on: "2024-01-01" },
      { version: "v2", deployed_on: "2024-01-02" },
    ]);
    const mockRollback = mock(async () => {});

    // We can't easily mock the imported CloudflareClient, but we can test the emit
    await command.execute(mockCtx);

    expect(mockCtx.observer.emit).toHaveBeenCalledWith(
      "command:start",
      expect.objectContaining({ cmd: "workers:rollback" })
    );
  });
});
