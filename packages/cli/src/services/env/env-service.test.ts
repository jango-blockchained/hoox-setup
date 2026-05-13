import { describe, expect, it } from "bun:test";
import { EnvService } from "./env-service.js";

describe("EnvService", () => {
  describe("getDefinitions", () => {
    it("returns all known env var definitions", () => {
      const defs = EnvService.getDefinitions();
      expect(defs.length).toBe(20);
      expect(defs.some(d => d.name === "CLOUDFLARE_API_TOKEN")).toBe(true);
    });

    it("each definition has required fields", () => {
      for (const def of EnvService.getDefinitions()) {
        expect(def.name).toBeTruthy();
        expect(typeof def.required).toBe("boolean");
        expect(typeof def.secret).toBe("boolean");
        expect(def.section).toBeTruthy();
      }
    });
  });

  describe("getSections", () => {
    it("returns unique sections in order", () => {
      const sections = EnvService.getSections();
      expect(sections.length).toBeGreaterThanOrEqual(5);
      expect(sections[0]).toBe("Cloudflare Account");
    });
  });

  describe("generateEnvLocal", () => {
    it("generates template with all vars", () => {
      const content = EnvService.generateEnvLocal();
      expect(content).toContain("CLOUDFLARE_API_TOKEN");
      expect(content).toContain("NEVER commit this file");
    });

    it("includes provided values", () => {
      const content = EnvService.generateEnvLocal({ SUBDOMAIN_PREFIX: "myapp" });
      expect(content).toContain('SUBDOMAIN_PREFIX="myapp"');
    });

    it("uses defaults for missing vars", () => {
      const content = EnvService.generateEnvLocal({});
      expect(content).toContain('SUBDOMAIN_PREFIX="cryptolinx"');
    });
  });

  describe("getWorkerDevVars", () => {
    it("maps vars to correct workers", () => {
      const vars = {
        AGENT_OPENAI_KEY: "sk-123",
        TELEGRAM_BOT_TOKEN: "tg-456",
        D1_INTERNAL_KEY: "d1-789",
      };
      const result = EnvService.getWorkerDevVars(vars);
      expect(result["workers/agent-worker"]).toBeDefined();
      expect(result["workers/agent-worker"].AGENT_OPENAI_KEY).toBe("sk-123");
      expect(result["workers/telegram-worker"]).toBeDefined();
      expect(result["workers/telegram-worker"].TELEGRAM_BOT_TOKEN).toBe("tg-456");
    });

    it("omits workers with no matching vars", () => {
      const result = EnvService.getWorkerDevVars({});
      expect(Object.keys(result).length).toBe(0);
    });

    it("omits empty-string vars", () => {
      const result = EnvService.getWorkerDevVars({ D1_INTERNAL_KEY: "" });
      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe("validate", () => {
    it("flags missing required vars", () => {
      const result = EnvService.validate({});
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing).toContain("CLOUDFLARE_API_TOKEN");
    });

    it("flags placeholder values as missing", () => {
      const result = EnvService.validate({ CLOUDFLARE_API_TOKEN: "your_cloudflare_api_token" });
      expect(result.missing).toContain("CLOUDFLARE_API_TOKEN");
    });

    it("passes when all required vars are set with real values", () => {
      const vars: Record<string, string> = {
        CLOUDFLARE_API_TOKEN: "cfut_xxx",
        CLOUDFLARE_ACCOUNT_ID: "abc123",
        SUBDOMAIN_PREFIX: "myapp",
        D1_INTERNAL_KEY: "d1-key",
        TRADE_INTERNAL_KEY: "trade-key",
        AGENT_INTERNAL_KEY: "agent-key",
        DASHBOARD_USER: "admin",
        DASHBOARD_PASS: "pass123",
        SESSION_SECRET: "a".repeat(32),
      };
      const result = EnvService.validate(vars);
      expect(result.missing.length).toBe(0);
    });

    it("warns on short session secret", () => {
      const vars: Record<string, string> = {
        CLOUDFLARE_API_TOKEN: "tok",
        CLOUDFLARE_ACCOUNT_ID: "id",
        SUBDOMAIN_PREFIX: "p",
        D1_INTERNAL_KEY: "k",
        TRADE_INTERNAL_KEY: "k",
        AGENT_INTERNAL_KEY: "k",
        DASHBOARD_USER: "u",
        DASHBOARD_PASS: "p",
        SESSION_SECRET: "short",
      };
      const result = EnvService.validate(vars);
      expect(result.warnings).toContain("SESSION_SECRET should be at least 32 characters");
    });
  });

  describe("show", () => {
    it("redacts secrets", () => {
      const output = EnvService.show({ CLOUDFLARE_API_TOKEN: "secret123" });
      expect(output).toContain("********");
      expect(output).not.toContain("secret123");
    });

    it("shows non-secrets in plain text", () => {
      const output = EnvService.show({ SUBDOMAIN_PREFIX: "myapp" });
      expect(output).toContain("myapp");
    });
  });

  describe("loadDotEnvAsync", () => {
    it("returns empty object for missing file", async () => {
      const result = await EnvService.loadDotEnvAsync("/tmp/nonexistent-file-12345.env");
      expect(Object.keys(result).length).toBe(0);
    });
  });
});
