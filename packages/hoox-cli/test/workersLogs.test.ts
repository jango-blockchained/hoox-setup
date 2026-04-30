import { describe, expect, it } from "bun:test";
import { buildTailLogsArgs, validateLogsArg } from "../src/commands/workers/logs.js";

describe("workers logs command arg validation", () => {
  it("builds explicit args for valid values", () => {
    expect(buildTailLogsArgs("trade-worker", { level: "error", follow: true })).toEqual([
      "wrangler",
      "tail",
      "--worker",
      "trade-worker",
      "--level",
      "error",
      "--follow",
    ]);
  });

  it("accepts safe worker and level values", () => {
    expect(() => validateLogsArg("agent-worker_1:prod", "workerName")).not.toThrow();
    expect(() => validateLogsArg("warn", "level")).not.toThrow();
  });

  it("rejects malicious workerName", () => {
    expect(() => validateLogsArg("trade-worker; rm -rf /", "workerName")).toThrow(
      "Invalid workerName: contains unsupported characters"
    );
  });

  it("rejects malicious level", () => {
    expect(() => validateLogsArg("error && whoami", "level")).toThrow(
      "Invalid level: contains unsupported characters"
    );
  });
});
