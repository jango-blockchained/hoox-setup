import { describe, expect, it } from "bun:test";
import { EnvService } from "./env-service.js";

describe("EnvService", () => {
  describe("getDefinitions", () => {
    it("returns all known env var definitions", () => {
      const defs = EnvService.getDefinitions();
      expect(defs.length).toBe(31);
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
      expect(sections.length).toBeGreaterThanOrEqual(7);
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

    it("maps all newly added vars to correct workers", () => {
      const vars = {
        WEBHOOK_API_KEY_BINDING: "webhook-key",
        HA_TOKEN_BINDING: "ha-token",
        API_SERVICE_KEY: "api-key",
        TELEGRAM_SECRET_TOKEN: "tg-secret",
        WALLET_MNEMONIC_SECRET: "mnemonic",
        WALLET_PK_SECRET: "pk",
        EMAIL_HOST: "imap.example.com",
        EMAIL_USER: "user",
        EMAIL_PASS: "pass",
        INTERNAL_KEY: "int-key",
      };
      const result = EnvService.getWorkerDevVars(vars);
      expect(result["workers/hoox"]).toBeDefined();
      expect(result["workers/hoox"].WEBHOOK_API_KEY_BINDING).toBe("webhook-key");
      expect(result["workers/hoox"].HA_TOKEN_BINDING).toBe("ha-token");
      expect(result["workers/trade-worker"].API_SERVICE_KEY).toBe("api-key");
      expect(result["workers/telegram-worker"].TELEGRAM_SECRET_TOKEN).toBe("tg-secret");
      expect(result["workers/web3-wallet-worker"]).toBeDefined();
      expect(result["workers/web3-wallet-worker"].WALLET_MNEMONIC_SECRET).toBe("mnemonic");
      expect(result["workers/email-worker"]).toBeDefined();
      expect(result["workers/email-worker"].EMAIL_HOST).toBe("imap.example.com");
    });
  });

  describe("validate", () => {
    it("flags missing required vars", () => {
      const result = EnvService.validate({});
      expect(result.missing.length).toBeGreaterThan(0);
      expect(result.missing).toContain("CLOUDFLARE_API_TOKEN");
    });

    it("flags 'your_' placeholder values as missing", () => {
      const result = EnvService.validate({ CLOUDFLARE_API_TOKEN: "your_cloudflare_api_token" });
      expect(result.missing).toContain("CLOUDFLARE_API_TOKEN");
    });

    it("flags 'generate_' placeholder values as missing", () => {
      const result = EnvService.validate({ SESSION_SECRET: "generate_a_32_character_secure_random_string" });
      expect(result.missing).toContain("SESSION_SECRET");
    });

    it("passes when all required vars are set with real values", () => {
      const vars: Record<string, string> = {
        CLOUDFLARE_API_TOKEN: "cfut_xxx",
        CLOUDFLARE_ACCOUNT_ID: "abc123",
        SUBDOMAIN_PREFIX: "myapp",
        D1_INTERNAL_KEY: "d1-key",
        TRADE_INTERNAL_KEY: "trade-key",
        AGENT_INTERNAL_KEY: "agent-key",
        WEBHOOK_API_KEY_BINDING: "webhook-key",
        INTERNAL_KEY_BINDING: "int-key",
        API_SERVICE_KEY: "api-key",
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
        WEBHOOK_API_KEY_BINDING: "wk",
        INTERNAL_KEY_BINDING: "ik",
        API_SERVICE_KEY: "ak",
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
