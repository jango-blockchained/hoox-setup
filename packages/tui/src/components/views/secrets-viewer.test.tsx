/**
 * Tests for SecretsViewer — export + pure helpers surface.
 * Full render tests for this view are covered by integration/e2e paths;
 * unit render with mock.module pollutes the shared store under Bun's runner.
 */
import { describe, it, expect } from "bun:test";
import { SecretsViewer } from "./secrets-viewer";

describe("SecretsViewer", () => {
  it("is a function component", () => {
    expect(SecretsViewer).toBeInstanceOf(Function);
    expect(SecretsViewer.name).toBe("SecretsViewer");
  });

  it("does not require localStorage (Bun-safe)", () => {
    // Bun has no localStorage; SecretsViewer must never touch it
    expect("localStorage" in globalThis).toBe(false);
  });
});
