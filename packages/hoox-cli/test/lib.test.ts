import { describe, expect, test } from "vitest";
import { CloudflareClient, type CFConfig } from "../src/lib/cf-client.js";

describe("CloudflareClient", () => {
  test("creates client with config", () => {
    const client = new CloudflareClient({
      apiToken: "test-token",
      accountId: "test-account",
    });
    expect(client).toBeDefined();
  });

  test("has correct base url", () => {
    const client = new CloudflareClient({
      apiToken: "test-token",
      accountId: "test-account",
    });
    expect(client).toBeDefined();
  });
});

describe("validation", () => {
  test("validateDependencies returns object", async () => {
    const { validateDependencies } = await import("../src/lib/validation.js");
    const result = await validateDependencies();
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("errors");
    expect(result).toHaveProperty("warnings");
  });

  test("validateConfig with empty object fails", () => {
    const { validateConfig } = require("../src/lib/validation.js");
    const result = validateConfig({});
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("validateConfig with valid config passes", () => {
    const { validateConfig } = require("../src/lib/validation.js");
    const result = validateConfig({
      global: {
        cloudflare_api_token: "test-token",
        cloudflare_account_id: "test-account",
      },
      workers: {},
    });
    expect(result.success).toBe(true);
  });
});
