import { describe, expect, test } from "bun:test";
import {
  authenticatedServiceFetch,
  D1_READ_AUTH_KEY_FIELDS,
  resolveInternalAuthKey,
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

  test("accepts internalKey override", async () => {
    let capturedHeaders: Headers | undefined;
    const binding = {
      fetch: async (_url: string, init?: RequestInit) => {
        capturedHeaders = new Headers(init?.headers);
        return new Response(null, { status: 200 });
      },
    };

    await authenticatedServiceFetch(
      binding,
      {},
      "/alert",
      { message: "hi" },
      { internalKey: "telegram-specific-key" }
    );

    expect(capturedHeaders?.get("X-Internal-Auth-Key")).toBe(
      "telegram-specific-key"
    );
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

describe("resolveInternalAuthKey", () => {
  test("returns first configured key from fallback list", () => {
    expect(
      resolveInternalAuthKey(
        { D1_READ_KEY_BINDING: "read-key", INTERNAL_KEY_BINDING: "full-key" },
        D1_READ_AUTH_KEY_FIELDS
      )
    ).toBe("read-key");
  });

  test("falls back to legacy INTERNAL_KEY_BINDING", () => {
    expect(
      resolveInternalAuthKey(
        { INTERNAL_KEY_BINDING: "full-key" },
        D1_READ_AUTH_KEY_FIELDS
      )
    ).toBe("full-key");
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
