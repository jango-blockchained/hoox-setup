import { describe, it, expect, mock, beforeEach } from "bun:test";
import { WorkersMonitorCommand } from "./monitor.js";

describe("WorkersMonitorCommand", () => {
  let cmd: WorkersMonitorCommand;

  beforeEach(() => {
    cmd = new WorkersMonitorCommand();
  });

  it("should have correct name and description", () => {
    expect(cmd.name).toBe("workers:monitor");
    expect(cmd.description).toContain("onitor");
  });

  it("should have worker option", () => {
    const workerOpt = cmd.options?.find(o => o.flag === "worker");
    expect(workerOpt).toBeDefined();
    expect(workerOpt?.short).toBe("w");
  });

  it("should have duration option", () => {
    const durationOpt = cmd.options?.find(o => o.flag === "duration");
    expect(durationOpt).toBeDefined();
    expect(durationOpt?.short).toBe("d");
  });

  it("should validate worker argument", () => {
    expect(() => (cmd as any).validateArg("trade-worker", "workerName")).not.toThrow();
    expect(() => (cmd as any).validateArg("invalid@worker", "workerName")).toThrow();
  });

  it("should validate duration argument", () => {
    expect(() => (cmd as any).validateArg("5m", "duration")).not.toThrow();
    expect(() => (cmd as any).validateArg("1h", "duration")).not.toThrow();
    expect(() => (cmd as any).validateArg("invalid!", "duration")).toThrow();
  });
});
