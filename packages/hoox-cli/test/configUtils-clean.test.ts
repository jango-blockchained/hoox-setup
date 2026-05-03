import { describe, expect, test, mock } from "bun:test";

// Mock modules
mock.module("../src/jsoncUtils.js", () => ({
  parseJsonc: mock((content: string) => {
    // Simple JSONC parser that removes comments and trailing commas
    let json = content
      .replace(/\/\/.*$/gm, "") // Remove single-line comments
      .replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
      .replace(/,(\s*[}\]])/g, "$1"); // Remove trailing commas
    return JSON.parse(json);
  }),
  isValidJsonc: mock((content: string) => {
    try {
      // Simple check - try to parse
      let json = content
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/,(\s*[}\]])/g, "$1");
      JSON.parse(json);
      return true;
    } catch {
      return false;
    }
  }),
  stringifyJsonc: mock((obj: unknown, indent?: number) => JSON.stringify(obj, null, indent)),
}));

// Import after mocking
const {
  loadConfig,
  saveConfig,
  redactForLogs,
  parseJsonc,
  stringifyToml,
  getWorkerNames,
} = await import("../src/configUtils.js");

describe("configUtils - loadConfig", () => {
  test("is a function", () => {
    expect(typeof loadConfig).toBe("function");
  });
});

describe("configUtils - saveConfig", () => {
  test("is a function", () => {
    expect(typeof saveConfig).toBe("function");
  });
});

describe("configUtils - redactForLogs", () => {
  test("is a function", () => {
    expect(typeof redactForLogs).toBe("function");
  });

  test("redacts secret values in objects", () => {
    const input = {
      name: "test",
      cloudflare_api_token: "secret-token",
      path: "/some/path",
    };
    
    const result = redactForLogs(input);
    
    expect(result.name).toBe("test");
    expect(result.cloudflare_api_token).toBe("[REDACTED]");
    expect(result.path).toBe("/some/path");
  });

  test("handles non-objects", () => {
    expect(redactForLogs("string")).toBe("string");
    expect(redactForLogs(123)).toBe(123);
    expect(redactForLogs(null)).toBeNull();
    expect(redactForLogs(undefined)).toBeUndefined();
  });
});

describe("configUtils - parseJsonc", () => {
  test("is a function", () => {
    expect(typeof parseJsonc).toBe("function");
  });
});

describe("configUtils - stringifyToml", () => {
  test("is a function", () => {
    expect(typeof stringifyToml).toBe("function");
  });
});

describe("configUtils - getWorkerNames", () => {
  test("is a function", () => {
    expect(typeof getWorkerNames).toBe("function");
  });
});
