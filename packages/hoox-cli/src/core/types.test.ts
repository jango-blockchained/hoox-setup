import { describe, it, expect } from "bun:test";
import type { CommandContext, Command, AppState, WorkerHealth } from "./types.js";

describe("Core Types", () => {
  it("should define Command interface with required fields", () => {
    const cmd: Command = {
      name: "test:command",
      description: "Test command",
      execute: async (ctx) => {},
    };
    expect(cmd.name).toBe("test:command");
    expect(cmd.description).toBe("Test command");
    expect(typeof cmd.execute).toBe("function");
  });

  it("should define AppState with correct structure", () => {
    const state: AppState = {
      commandStatus: "idle",
      workers: {},
      system: {
        bunVersion: "1.0.0",
        memoryUsage: process.memoryUsage(),
      },
    };
    expect(state.commandStatus).toBe("idle");
    expect(state.system.bunVersion).toBe("1.0.0");
  });

  it("should define WorkerHealth type", () => {
    const health: WorkerHealth = {
      name: "trade-worker",
      status: "healthy",
      lastDeployed: "2026-05-04",
      errorRate: 0.01,
      responseTime: 120,
    };
    expect(health.status).toBe("healthy");
  });
});
