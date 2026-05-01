import { describe, it, expect } from "bun:test";
import { ConfigSchema } from "../src/types.js";

describe("ConfigSchema Validation", () => {
  it("strictly enforces required submodule definitions", () => {
    const invalidConfig = {
      global: { cloudflare_api_token: "test" },
      workers: {},
    };
    const result = ConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false); // Should fail due to missing required fields
  });
});
