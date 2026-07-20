import { describe, it, expect } from "bun:test";
import { copyToClipboard, copyViaSystemClipboard } from "./clipboard";

describe("clipboard", () => {
  it("treats empty text as success without throwing", async () => {
    const result = await copyToClipboard("   ", null);
    expect(result.ok).toBe(true);
  });

  it("copyViaSystemClipboard returns a tool name or null", async () => {
    const tool = await copyViaSystemClipboard("hoox-clipboard-test");
    // CI may lack clipboard tools; null is acceptable
    expect(tool === null || typeof tool === "string").toBe(true);
  });

  it("copyToClipboard falls back when no renderer is available", async () => {
    const result = await copyToClipboard("hello from hoox tui", null);
    // Success if system tool exists; otherwise structured failure
    if (result.ok) {
      expect(result.method === "osc52" || result.method === "system").toBe(
        true
      );
    } else {
      expect(result.error).toMatch(/clipboard/i);
    }
  });
});
