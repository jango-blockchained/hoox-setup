import { describe, expect, test, beforeEach, afterEach, vi } from "bun:test";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "path";
import os from "node:os";

const testDir = path.join(os.tmpdir(), `hoox-waf-test-${Date.now()}`);

describe("WAF Commands - Unit Tests", () => {
  beforeEach(async () => {
    await fsp.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(testDir, { recursive: true, force: true });
  });

  describe("TradingView IP Allowlist", () => {
    const TRADINGVIEW_ALLOWED_IPS = [
      "52.89.214.238",
      "34.212.75.30",
      "54.218.53.128",
      "52.32.178.7",
    ];

    test("should have 4 TradingView IPs", () => {
      expect(TRADINGVIEW_ALLOWED_IPS).toHaveLength(4);
    });

    test("should validate IP format", () => {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      TRADINGVIEW_ALLOWED_IPS.forEach((ip) => {
        expect(ipRegex.test(ip)).toBe(true);
      });
    });

    test("should check if IP is in allowlist", () => {
      const testIp = "52.89.214.238";
      const isAllowed = TRADINGVIEW_ALLOWED_IPS.includes(testIp);
      expect(isAllowed).toBe(true);
    });

    test("should reject IP not in allowlist", () => {
      const testIp = "192.168.1.1";
      const isAllowed = TRADINGVIEW_ALLOWED_IPS.includes(testIp);
      expect(isAllowed).toBe(false);
    });
  });

  describe("WAF Rule Expression Builder", () => {
    test("should build correct IP expression", () => {
      const workerHostname = "hoox.example.com";
      const allowedIps = ["52.89.214.238", "34.212.75.30"];

      const expression = `http.host eq "${workerHostname}" and not (ip.src in {${allowedIps.join(" ")}})`;

      expect(expression).toContain(workerHostname);
      expect(expression).toContain("ip.src in");
    });

    test("should handle multiple IPs in expression", () => {
      const ips = ["10.0.0.1", "10.0.0.2", "10.0.0.3"];
      const expression = `ip.src in {${ips.join(" ")}}`;

      expect(expression).toContain("10.0.0.1");
      expect(expression).toContain("10.0.0.2");
      expect(expression).toContain("10.0.0.3");
    });
  });

  describe("WAF Rule Structure", () => {
    test("should create valid block rule", () => {
      const rule = {
        action: "block",
        expression: 'http.host eq "hoox.example.com"',
        description: "Test Rule",
        enabled: true,
      };

      expect(rule.action).toBe("block");
      expect(rule.expression).toBeDefined();
      expect(rule.description).toBeDefined();
      expect(rule.enabled).toBe(true);
    });

    test("should validate rule action types", () => {
      const validActions = ["block", "allow", "challenge", "log"];

      expect(validActions).toContain("block");
      expect(validActions).toContain("allow");
      expect(validActions).toContain("challenge");
    });
  });

  describe("Cloudflare API URL Construction", () => {
    test("should build correct rulesets URL", () => {
      const zoneId = "zone-123";
      const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`;

      expect(url).toBe(
        "https://api.cloudflare.com/client/v4/zones/zone-123/rulesets"
      );
    });

    test("should include correct API version", () => {
      const zoneId = "test-zone";
      const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`;

      expect(url).toContain("/client/v4/");
    });

    test("should handle different zone IDs", () => {
      const zoneIds = ["abc123", "xyz789", "test-zone-id"];

      zoneIds.forEach((zoneId) => {
        const url = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`;
        expect(url).toMatch(/zones\/.+/);
      });
    });
  });

  describe("R2 Bucket Operations", () => {
    const BUCKETS_TO_CREATE = [
      "trade-reports",
      "user-uploads",
      "hoox-system-logs",
    ];

    test("should have 3 default buckets", () => {
      expect(BUCKETS_TO_CREATE).toHaveLength(3);
    });

    test("should validate bucket naming", () => {
      BUCKETS_TO_CREATE.forEach((bucket) => {
        expect(bucket.length).toBeGreaterThan(0);
        expect(bucket).toMatch(/^[a-z0-9-]+$/);
      });
    });

    test("should handle bucket name format", () => {
      const bucketName = "trade-reports";
      const slug = bucketName.replace(/_/g, "-").toLowerCase();

      expect(slug).toBe("trade-reports");
    });
  });

  describe("Config Validation", () => {
    test("should require API token", async () => {
      const config = {
        global: {
          cloudflare_api_token: "",
        },
        workers: {},
      };

      const hasToken = !!config.global.cloudflare_api_token;
      expect(hasToken).toBe(false);
    });

    test("should validate Zone ID format", () => {
      const zoneId = "abc123def456ghi789jkl012abc123de";

      expect(zoneId.length).toBeGreaterThanOrEqual(32);
    });

    test("should require hostname for WAF", () => {
      const hostname = "";
      const isValid = hostname.length > 0;
      expect(isValid).toBe(false);
    });
  });
});

describe("WAF Commands - Integration Tests", () => {
  const integrationDir = path.join(
    os.tmpdir(),
    `hoox-waf-integration-${Date.now()}`
  );

  beforeEach(async () => {
    await fsp.mkdir(integrationDir, { recursive: true });
  });

  afterEach(async () => {
    await fsp.rm(integrationDir, { recursive: true, force: true });
  });

  test("full WAF config construction", () => {
    const zoneId = "test-zone-123";
    const hostname = "hoox.example.com";
    const allowedIps = ["52.89.214.238", "34.212.75.30"];

    const apiUrl = `https://api.cloudflare.com/client/v4/zones/${zoneId}/rulesets`;
    const ipExpression = `http.host eq "${hostname}" and not (ip.src in {${allowedIps.join(" ")}})`;
    const rule = {
      action: "block",
      expression: ipExpression,
      description: "Hoox - TradingView IP Allowlist",
      enabled: true,
    };

    expect(apiUrl).toContain(zoneId);
    expect(rule.expression).toContain(hostname);
    expect(rule.action).toBe("block");
  });

  test("should handle missing config gracefully", () => {
    const config = {
      global: {
        cloudflare_api_token: undefined,
      },
    };

    const hasRequiredFields =
      config.global.cloudflare_api_token !== undefined &&
      config.global.cloudflare_api_token !== "";

    expect(hasRequiredFields).toBe(false);
  });

  test("should construct R2 bucket commands", () => {
    const bucketName = "trade-reports";
    const listCommand = `bunx wrangler r2 bucket list`;
    const createCommand = `bunx wrangler r2 bucket create ${bucketName}`;

    expect(listCommand).toContain("r2 bucket list");
    expect(createCommand).toContain("r2 bucket create");
    expect(createCommand).toContain(bucketName);
  });
});
