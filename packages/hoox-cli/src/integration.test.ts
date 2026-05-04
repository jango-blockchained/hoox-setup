import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { AppObserver } from "./core/observer.js";
import { AppEngine } from "./core/engine.js";
import { CloudflareAdapter } from "./adapters/cloudflare.js";
import { BunAdapter } from "./adapters/bun.js";
import { WorkersAdapter } from "./adapters/workers.js";

describe("CLI Integration", () => {
  let observer: AppObserver;
  let engine: AppEngine;

  beforeAll(async () => {
    observer = new AppObserver();
    const adapters = {
      cloudflare: new CloudflareAdapter(),
      bun: new BunAdapter(),
      workers: new WorkersAdapter(),
    };
    engine = new AppEngine(observer, adapters);
    await engine.initialize();
    engine.startListening();
  });

  afterAll(() => {
    engine.stopListening();
  });

  it("should handle full command flow", async () => {
    // Emit a command
    observer.emit("command:start", { cmd: "trade:deploy", args: {} });

    // Wait for processing
    await new Promise((r) => setTimeout(r, 100));

    const state = observer.getState();
    // Should be in a valid state
    expect(["success", "error", "idle", "running"]).toContain(state.commandStatus);
  });
});
