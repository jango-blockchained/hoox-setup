import { describe, it, expect, beforeEach } from "bun:test";
import { AppObserver } from "./observer.js";
import type { AppState } from "./types.js";

describe("AppObserver", () => {
  let observer: AppObserver;

  beforeEach(() => {
    observer = new AppObserver();
  });

  it("should initialize with default state", () => {
    const state = observer.getState();
    expect(state.commandStatus).toBe("idle");
    expect(state.workers).toEqual({});
    expect(state.system.bunVersion).toBe(Bun.version);
  });

  it("should update state via setState", () => {
    observer.setState({ currentCommand: "test:command" });
    const state = observer.getState();
    expect(state.currentCommand).toBe("test:command");
    expect(state.commandStatus).toBe("idle"); // Preserves other fields
  });

  it("should notify subscribers on state change", async () => {
    let notifiedState: AppState | null = null;
    const unsub = observer.subscribe((state) => {
      notifiedState = state;
    });

    observer.setState({ commandStatus: "running" });
    
    // Give event loop a tick
    await new Promise((r) => setTimeout(r, 0));
    
    expect(notifiedState).not.toBeNull();
    expect(notifiedState!.commandStatus).toBe("running");
    unsub();
  });

  it("should support event emission", async () => {
    let eventData: unknown = null;
    const unsub = observer.on("test:event", (data) => {
      eventData = data;
    });

    observer.emit("test:event", { key: "value" });
    await new Promise((r) => setTimeout(r, 0));

    expect(eventData).toEqual({ key: "value" });
    unsub();
  });

  it("should update system metrics", () => {
    const before = observer.getState();
    observer.updateSystemMetrics();
    const after = observer.getState();
    
    expect(after.system.memoryUsage).toBeDefined();
    expect(after.system.memoryUsage.heapUsed).toBeDefined();
  });

  it("should return cloned state to prevent mutation", () => {
    const state1 = observer.getState();
    const state2 = observer.getState();
    
    expect(state1).not.toBe(state2); // Different references
    expect(state1).toEqual(state2); // Same content
  });
});
