import { describe, it, expect, afterEach } from "bun:test";
import { resolveGatewayUrl } from "./endpoint-resolver.js";

describe("resolveGatewayUrl", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("uses HOOX_GATEWAY_URL env var when set", () => {
    process.env.HOOX_GATEWAY_URL = "https://custom.hoox.example.com";
    expect(resolveGatewayUrl()).toBe("https://custom.hoox.example.com");
  });

  it("constructs URL from CLOUDFLARE_ACCOUNT_ID and worker name", () => {
    delete process.env.HOOX_GATEWAY_URL;
    process.env.CLOUDFLARE_ACCOUNT_ID = "abc123";
    const url = resolveGatewayUrl({ workerName: "hoox" });
    expect(url).toBe("https://hoox.abc123.workers.dev");
  });

  it("strips trailing slash from env-var URL", () => {
    process.env.HOOX_GATEWAY_URL = "https://custom.hoox.example.com/";
    expect(resolveGatewayUrl()).toBe("https://custom.hoox.example.com");
  });

  it("throws clear error when nothing is available", () => {
    delete process.env.HOOX_GATEWAY_URL;
    delete process.env.CLOUDFLARE_ACCOUNT_ID;
    expect(() => resolveGatewayUrl({ workerName: "hoox" })).toThrow(
      /HOOX_GATEWAY_URL.*CLOUDFLARE_ACCOUNT_ID/
    );
  });
});
