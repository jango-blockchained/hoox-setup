import { describe, it, expect } from "bun:test";
import {
  CLIError,
  WorkerDeployError,
  ConfigValidationError,
} from "./errors.js";

describe("Error Classes", () => {
  it("should create CLIError with code and recoverable flag", () => {
    const err = new CLIError("Test error", "TEST_CODE", false);
    expect(err.message).toBe("Test error");
    expect(err.code).toBe("TEST_CODE");
    expect(err.recoverable).toBe(false);
    expect(err.name).toBe("CLIError");
  });

  it("should default to recoverable=true", () => {
    const err = new CLIError("Test error", "TEST_CODE");
    expect(err.recoverable).toBe(true);
  });

  it("should create WorkerDeployError with cause", () => {
    const cause = new Error("Connection failed");
    const err = new WorkerDeployError("trade-worker", cause);
    expect(err.message).toBe(
      "Failed to deploy trade-worker: Connection failed"
    );
    expect(err.code).toBe("DEPLOY_FAILED");
    expect(err.cause).toBe(cause);
  });

  it("should create ConfigValidationError", () => {
    const err = new ConfigValidationError("api_token");
    expect(err.message).toBe("Invalid configuration: api_token is required");
    expect(err.code).toBe("CONFIG_INVALID");
  });
});
