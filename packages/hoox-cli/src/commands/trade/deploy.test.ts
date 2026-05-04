import { describe, it, expect, beforeEach, mock } from "bun:test";
import { TradeDeployCommand } from "./deploy.js";
import type { CommandContext } from "../../core/types.js";

describe("TradeDeployCommand", () => {
  let command: TradeDeployCommand;
  let mockCtx: CommandContext;

  beforeEach(() => {
    command = new TradeDeployCommand();
    mockCtx = {
      observer: { emit: mock(() => {}), setState: mock(() => {}) } as any,
      engine: {} as any,
      adapters: {
        cloudflare: { deployWorker: mock(async () => {}) } as any,
        bun: {} as any,
        workers: {} as any,
      },
      cwd: "/test",
    };
  });

  it("should have correct name and description", () => {
    expect(command.name).toBe("trade:deploy");
    expect(command.description).toBe("Deploy the trade-worker to Cloudflare");
  });

  it("should have force option", () => {
    expect(command.options).toBeDefined();
    expect(command.options?.[0].flag).toBe("force");
  });
});
