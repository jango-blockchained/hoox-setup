import { describe, expect, it } from "bun:test";
import {
  validateWranglerJsonc,
  validateRootSecrets,
  validateDevVars,
  generateWranglerJsonc,
  generateDevVars,
} from "../../src/schemas/validators.js";
import { WORKER_MANIFESTS } from "../../src/schemas/registry.js";

describe("validateWranglerJsonc", () => {
  const manifest = WORKER_MANIFESTS["d1-worker"]!;

  it("should pass for a valid wrangler.jsonc", () => {
    const jsonc = JSON.stringify({
      name: "d1-worker",
      main: "src/index.ts",
      vars: { INTERNAL_KEY_BINDING: "__SECRET__" },
      services: [],
    });
    const errors = validateWranglerJsonc("d1-worker", manifest, jsonc);
    expect(errors.filter((e) => e.severity === "error")).toHaveLength(0);
  });

  it("should detect missing vars", () => {
    const jsonc = JSON.stringify({
      name: "d1-worker",
      main: "src/index.ts",
      vars: {},
      services: [],
    });
    const errors = validateWranglerJsonc("d1-worker", manifest, jsonc);
    expect(errors.filter((e) => e.severity === "error")).toHaveLength(1);
    expect(errors[0].message).toContain("INTERNAL_KEY_BINDING");
  });

  it("should detect wrong service target", () => {
    const manifest = WORKER_MANIFESTS["hoox"]!;
    const jsonc = JSON.stringify({
      name: "hoox",
      vars: {
        WEBHOOK_API_KEY_BINDING: "__SECRET__",
        INTERNAL_KEY_BINDING: "__SECRET__",
        HA_TOKEN_BINDING: "__SECRET__",
      },
      services: [
        { binding: "TRADE_SERVICE", service: "wrong-worker" },
        { binding: "TELEGRAM_SERVICE", service: "telegram-worker" },
      ],
    });
    const errors = validateWranglerJsonc("hoox", manifest, jsonc);
    const serviceErrors = errors.filter((e) =>
      e.message.includes("TRADE_SERVICE")
    );
    expect(serviceErrors.length).toBeGreaterThan(0);
  });

  it("should warn on unexpected service binding", () => {
    const manifest = WORKER_MANIFESTS["telegram-worker"]!;
    const jsonc = JSON.stringify({
      name: "telegram-worker",
      vars: {
        INTERNAL_KEY_BINDING: "__SECRET__",
        TG_BOT_TOKEN_BINDING: "__SECRET__",
        TG_CHAT_ID_BINDING: "__SECRET__",
        TELEGRAM_SECRET_TOKEN: "__SECRET__",
      },
      services: [{ binding: "UNEXPECTED_SERVICE", service: "some-worker" }],
    });
    const errors = validateWranglerJsonc("telegram-worker", manifest, jsonc);
    const warnings = errors.filter((e) => e.severity === "warning");
    expect(warnings.some((w) => w.message.includes("UNEXPECTED_SERVICE"))).toBe(
      true
    );
  });

  it("should handle unparseable JSONC gracefully", () => {
    const errors = validateWranglerJsonc("d1-worker", manifest, "");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("Failed to parse");
  });
});

describe("validateRootSecrets", () => {
  const manifest = WORKER_MANIFESTS["d1-worker"]!;

  it("should detect when secret is missing from root config", () => {
    const rootJsonc = JSON.stringify({
      workers: {
        "d1-worker": {
          enabled: true,
          path: "workers/d1-worker",
          vars: {},
          secrets: [],
        },
      },
    });
    const errors = validateRootSecrets("d1-worker", manifest, rootJsonc);
    expect(errors.filter((e) => e.severity === "error")).toHaveLength(1);
    expect(errors[0].message).toContain("INTERNAL_KEY_BINDING");
  });

  it("should pass when all secrets are present", () => {
    const rootJsonc = JSON.stringify({
      workers: {
        "d1-worker": {
          enabled: true,
          path: "workers/d1-worker",
          vars: {},
          secrets: ["INTERNAL_KEY_BINDING"],
        },
      },
    });
    const errors = validateRootSecrets("d1-worker", manifest, rootJsonc);
    expect(errors.filter((e) => e.severity === "error")).toHaveLength(0);
  });
});

describe("validateDevVars", () => {
  const manifest = WORKER_MANIFESTS["d1-worker"]!;

  it("should detect missing secret in .dev.vars", () => {
    const content = "# just a comment\nSOME_OTHER_VAR=value\n";
    const errors = validateDevVars("d1-worker", manifest, content);
    expect(errors.filter((e) => e.severity === "error")).toHaveLength(1);
    expect(errors[0].message).toContain("INTERNAL_KEY_BINDING");
  });

  it("should pass when all secrets are present", () => {
    const content = "INTERNAL_KEY_BINDING=placeholder\n";
    const errors = validateDevVars("d1-worker", manifest, content);
    expect(errors.filter((e) => e.severity === "error")).toHaveLength(0);
  });

  it("should ignore comments and blank lines", () => {
    const content = "# comment\n\nINTERNAL_KEY_BINDING=placeholder\n\n";
    const errors = validateDevVars("d1-worker", manifest, content);
    expect(errors.filter((e) => e.severity === "error")).toHaveLength(0);
  });
});

describe("generateWranglerJsonc", () => {
  it("should produce valid JSON", () => {
    const manifest = WORKER_MANIFESTS["d1-worker"]!;
    const output = generateWranglerJsonc(manifest);
    expect(output).toContain('"name"');
    expect(output).toContain('"INTERNAL_KEY_BINDING"');
  });

  it("should include service bindings when present", () => {
    const manifest = WORKER_MANIFESTS["hoox"]!;
    const output = generateWranglerJsonc(manifest);
    expect(output).toContain("TRADE_SERVICE");
    expect(output).toContain("TELEGRAM_SERVICE");
  });
});

describe("generateDevVars", () => {
  it("should include all secret vars", () => {
    const manifest = WORKER_MANIFESTS["d1-worker"]!;
    const output = generateDevVars(manifest);
    expect(output).toContain("INTERNAL_KEY_BINDING");
    expect(output).toContain("placeholder_");
  });

  it("should include header comment", () => {
    const manifest = WORKER_MANIFESTS["hoox"]!;
    const output = generateDevVars(manifest);
    expect(output).toContain("Auto-generated from worker manifest schema");
  });
});
