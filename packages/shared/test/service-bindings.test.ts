import { describe, expect, test } from "bun:test";
import {
  authenticatedServiceFetch,
  ServiceAuthError,
  serviceFetch,
} from "../src/service-bindings";

describe("authenticatedServiceFetch", () => {
  test("injects X-Internal-Auth-Key from env", async () => {
    let capturedHeaders: Headers | undefined;
    const binding = {
      fetch: async (_url: string, init?: RequestInit) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      },
    };

    await authenticatedServiceFetch(
      binding,
      { INTERNAL_KEY_BINDING: "secret-key" },
      "/webhook",
      { action: "LONG" }
    );

    expect(capturedHeaders?.get("X-Internal-Auth-Key")).toBe("secret-key");
    expect(capturedHeaders?.get("Content-Type")).toBe("application/json");
  });

  test("rejects when INTERNAL_KEY_BINDING is missing (fail-closed)", async () => {
    const binding = {
      fetch: async () => new Response(null, { status: 200 }),
    };

    await expect(
      authenticatedServiceFetch(binding, {}, "/webhook", {})
    ).rejects.toBeInstanceOf(ServiceAuthError);
  });

  test("merges custom headers", async () => {
    let capturedHeaders: Headers | undefined;
    const binding = {
      fetch: async (_url: string, init?: RequestInit) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response(null, { status: 200 });
      },
    };

    await authenticatedServiceFetch(
      binding,
      { INTERNAL_KEY_BINDING: "k" },
      "/path",
      undefined,
      { method: "GET", headers: { "X-Request-ID": "req-1" } }
    );

    expect(capturedHeaders?.get("X-Request-ID")).toBe("req-1");
    expect(capturedHeaders?.get("X-Internal-Auth-Key")).toBe("k");
  });
});

describe("serviceFetch", () => {
  test("targets internal host prefix", async () => {
    let capturedUrl = "";
    const binding = {
      fetch: async (url: string) => {
        capturedUrl = String(url);
        return new Response(null, { status: 200 });
      },
    };

    await serviceFetch(binding, "/health");
    expect(capturedUrl).toBe("http://internal/health");
  });
});
