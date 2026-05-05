import { describe, it, expect } from "bun:test";
import { createValidationResult, formatValidationResults } from "./validation.js";

describe("validation utilities", () => {
  it("creates empty validation result", () => {
    const result = createValidationResult("test-check");
    expect(result.name).toBe("test-check");
    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it("adds errors and changes success to false", () => {
    const result = createValidationResult("test-check");
    result.addError("Missing file");
    expect(result.success).toBe(false);
    expect(result.errors).toContain("Missing file");
  });

  it("adds warnings without changing success", () => {
    const result = createValidationResult("test-check");
    result.addWarning("Deprecated option");
    expect(result.success).toBe(true);
    expect(result.warnings).toContain("Deprecated option");
  });

  it("formats validation results", () => {
    const passing = createValidationResult("pass-check");
    const failing = createValidationResult("fail-check");
    failing.addError("Something broke");
    failing.addWarning("Minor issue");

    const output = formatValidationResults([passing, failing]);
    expect(output).toContain("✓ pass-check");
    expect(output).toContain("✗ fail-check");
    expect(output).toContain("✗ Something broke");
    expect(output).toContain("⚠ Minor issue");
  });
});
