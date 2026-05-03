import { describe, expect, test, mock } from "bun:test";

// Mock modules
mock.module("../src/lib/cf-client.ts", () => ({
  CloudflareClient: mock((config: any) => ({
    listZones: mock(async () => []),
    getD1Database: mock(async () => ({})),
    listKVNamespaces: mock(async () => []),
  })),
  createValidationResult: mock((success: boolean, errors: string[], warnings: string[]) => ({
    success,
    errors,
    warnings,
  })),
}));

mock.module("../src/configUtils.js", () => ({
  loadConfig: mock(async () => ({
    global: { cloudflare_api_token: "token", cloudflare_account_id: "acc" },
    workers: {},
  })),
}));

// Import after mocking
const {
  validateDependencies,
  validateAuth,
  validateConfig,
  validateWorkers,
  validateResources,
  fixDependencies,
  repairResources,
} = await import("../src/lib/validation.js");

describe("validation - validateDependencies", () => {
  test("is a function", () => {
    expect(typeof validateDependencies).toBe("function");
  });

  test("returns object with success property", async () => {
    const result = await validateDependencies();
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("errors");
    expect(result).toHaveProperty("warnings");
  });
});

describe("validation - validateAuth", () => {
  test("is a function", () => {
    expect(typeof validateAuth).toBe("function");
  });

  test("returns object with success property", async () => {
    const result = await validateAuth("token", "acc");
    expect(result).toHaveProperty("success");
  });
});

describe("validation - validateConfig", () => {
  test("is a function", () => {
    expect(typeof validateConfig).toBe("function");
  });

  test("returns failure for empty object", () => {
    const result = validateConfig({});
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test("returns success for valid config", () => {
    const result = validateConfig({
      global: {
        cloudflare_api_token: "test-token",
        cloudflare_account_id: "test-account",
      },
      workers: {},
    });
    expect(result.success).toBe(true);
  });

  test("returns failure when missing required fields", () => {
    const result = validateConfig({
      global: {},
      workers: {},
    });
    expect(result.success).toBe(false);
  });

  test("returns warning for empty workers", () => {
    const result = validateConfig({
      global: {
        cloudflare_api_token: "token",
        cloudflare_account_id: "acc",
      },
      workers: {},
    });
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test("returns error for worker without path", () => {
    const result = validateConfig({
      global: {
        cloudflare_api_token: "token",
        cloudflare_account_id: "acc",
      },
      workers: {
        "worker1": { enabled: true },
      },
    });
    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("validation - validateWorkers", () => {
  test("is a function", () => {
    expect(typeof validateWorkers).toBe("function");
  });

  test("returns success for valid workers", async () => {
    const result = await validateWorkers({
      "worker1": { enabled: true, path: "/some/path" },
    });
    expect(result).toHaveProperty("success");
  });

  test("skips disabled workers", async () => {
    const result = await validateWorkers({
      "worker1": { enabled: false, path: "/some/path" },
    });
    expect(result.success).toBe(true);
  });
});

describe("validation - validateResources", () => {
  test("is a function", () => {
    expect(typeof validateResources).toBe("function");
  });

  test("returns object with success property", async () => {
    const result = await validateResources({
      global: {
        cloudflare_api_token: "token",
        cloudflare_account_id: "acc",
      },
      workers: {},
    });
    expect(result).toHaveProperty("success");
  });
});

describe("validation - fixDependencies", () => {
  test("is a function", () => {
    expect(typeof fixDependencies).toBe("function");
  });
});

describe("validation - repairResources", () => {
  test("is a function", () => {
    expect(typeof repairResources).toBe("function");
  });

  test("returns object with warnings", async () => {
    const result = await repairResources({
      global: {
        cloudflare_api_token: "token",
        cloudflare_account_id: "acc",
      },
      workers: {},
    });
    expect(result).toHaveProperty("warnings");
  });
});
