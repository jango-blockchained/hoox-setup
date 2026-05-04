import { describe, it, expect, beforeEach, mock } from "bun:test";
import { AppEngine } from "./engine.js";
import { AppObserver } from "./observer.js";
import type { CommandContext } from "./types.js";

describe("AppEngine", () => {
  let engine: AppEngine;
  let observer: AppObserver;
  let mockAdapters: CommandContext["adapters"];

  beforeEach(() => {
    observer = new AppObserver();
    mockAdapters = {
      cloudflare: { deployWorker: async () => {}, testConnection: async () => true } as any,
      bun: { readFile: async () => "", writeFile: async () => {} } as any,
      workers: { callServiceBinding: async () => ({}) } as any,
    };
    engine = new AppEngine(observer, mockAdapters);
  });

  it("should initialize adapters", async () => {
    await engine.initialize();
    // Should not throw
  });

  it("should start and stop listening", () => {
    engine.startListening();
    engine.stopListening();
    // Should not throw
  });

  it("should handle commands via observer events", async () => {
    await engine.initialize();
    engine.startListening();

    // Emit command start event
    observer.emit("command:start", { cmd: "test:command", args: {} });
    
    await new Promise((r) => setTimeout(r, 10));
    
    engine.stopListening();
  });
});
