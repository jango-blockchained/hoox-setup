/**
 * Comprehensive test suite for rate-limit middleware
 * Tests rate limiting by IP, headers, window reset, and custom options
 */

import { describe, it, expect } from "bun:test";
import { createRateLimiter } from "./rate-limit";

// Mock KV namespace for testing
class MockKV {
  private store: Map<string, string> = new Map();
  private expirations: Map<string, number> = new Map();

  async get(key: string): Promise<string | null> {
    const expiration = this.expirations.get(key);
    if (expiration && Date.now() > expiration) {
      this.store.delete(key);
      this.expirations.delete(key);
      return null;
    }
    return this.store.get(key) ?? null;
  }

  async put(
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void> {
    this.store.set(key, value);
    if (options?.expirationTtl) {
      this.expirations.set(key, Date.now() + options.expirationTtl * 1000);
    }
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
    this.expirations.delete(key);
  }

  async list(): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async getWithMetadata(): Promise<unknown> {
    throw new Error("Not implemented");
  }

  async getMultiple(): Promise<unknown> {
    throw new Error("Not implemented");
  }
}

describe("createRateLimiter", () => {
  it("creates a rate limiter with config", () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 10,
      windowSeconds: 60,
    });
    expect(limiter).toBeDefined();
    expect(limiter.check).toBeDefined();
    expect(limiter.enforce).toBeDefined();
  });

  it("has check and enforce methods", () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 10,
      windowSeconds: 60,
    });
    expect(typeof limiter.check).toBe("function");
    expect(typeof limiter.enforce).toBe("function");
  });
});

describe("RateLimiter.check", () => {
  it("allows requests within limit", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 10,
      windowSeconds: 60,
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    const result = await limiter.check(request);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("returns remaining count", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 5,
      windowSeconds: 60,
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    const result = await limiter.check(request);
    expect(result.remaining).toBe(4);
  });

  it("rejects requests exceeding limit", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 2,
      windowSeconds: 60,
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    // First request
    const result1 = await limiter.check(request);
    expect(result1.allowed).toBe(true);

    // Second request
    const result2 = await limiter.check(request);
    expect(result2.allowed).toBe(true);

    // Third request (exceeds limit)
    const result3 = await limiter.check(request);
    expect(result3.allowed).toBe(false);
  });

  it("returns 0 remaining when limit exceeded", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 1,
      windowSeconds: 60,
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    // First request
    await limiter.check(request);

    // Second request (exceeds limit)
    const result = await limiter.check(request);
    expect(result.remaining).toBe(0);
  });

  it("includes retryAfter when limit exceeded", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 1,
      windowSeconds: 60,
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    // First request
    await limiter.check(request);

    // Second request (exceeds limit)
    const result = await limiter.check(request);
    expect(result.retryAfter).toBeDefined();
    expect(typeof result.retryAfter).toBe("number");
  });

  it("tracks rate limit per IP address", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 1,
      windowSeconds: 60,
    });

    const request1 = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });
    const request2 = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.2" },
    });

    // First IP - first request
    const result1 = await limiter.check(request1);
    expect(result1.allowed).toBe(true);

    // First IP - second request (exceeds limit)
    const result2 = await limiter.check(request1);
    expect(result2.allowed).toBe(false);

    // Second IP - first request (should be allowed)
    const result3 = await limiter.check(request2);
    expect(result3.allowed).toBe(true);
  });

  it("uses CF-Connecting-IP header for IP extraction", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 1,
      windowSeconds: 60,
    });

    const request1 = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "10.0.0.1" },
    });
    const request2 = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "10.0.0.2" },
    });

    const result1 = await limiter.check(request1);
    expect(result1.allowed).toBe(true);

    const result2 = await limiter.check(request1);
    expect(result2.allowed).toBe(false);

    const result3 = await limiter.check(request2);
    expect(result3.allowed).toBe(true);
  });

  it("uses 'unknown' IP when CF-Connecting-IP not provided", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 1,
      windowSeconds: 60,
    });

    const request1 = new Request("https://example.com/api/test");
    const request2 = new Request("https://example.com/api/test");

    const result1 = await limiter.check(request1);
    expect(result1.allowed).toBe(true);

    // Second request without IP header should use same 'unknown' key
    const result2 = await limiter.check(request2);
    expect(result2.allowed).toBe(false);
  });

  it("supports custom key prefix", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 10,
      windowSeconds: 60,
      keyPrefix: "custom-prefix",
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    const result = await limiter.check(request);
    expect(result.allowed).toBe(true);
  });
});

describe("RateLimiter.enforce", () => {
  it("returns null when request allowed", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 10,
      windowSeconds: 60,
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    const result = await limiter.enforce(request);
    expect(result).toBeNull();
  });

  it("returns 429 response when limit exceeded", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 1,
      windowSeconds: 60,
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    // First request
    await limiter.enforce(request);

    // Second request (exceeds limit)
    const result = await limiter.enforce(request);
    expect(result).toBeInstanceOf(Response);
    expect(result?.status).toBe(429);
  });

  it("includes error message in 429 response", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 1,
      windowSeconds: 60,
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    // First request
    await limiter.enforce(request);

    // Second request (exceeds limit)
    const result = await limiter.enforce(request);
    const body = (await result?.json()) as Record<string, unknown>;
    expect(body.error).toBe("Rate limit exceeded");
  });

  it("includes Retry-After header in 429 response", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 1,
      windowSeconds: 60,
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    // First request
    await limiter.enforce(request);

    // Second request (exceeds limit)
    const result = await limiter.enforce(request);
    expect(result?.headers.get("Retry-After")).toBeDefined();
  });

  it("includes retryAfter in response body", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 1,
      windowSeconds: 60,
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    // First request
    await limiter.enforce(request);

    // Second request (exceeds limit)
    const result = await limiter.enforce(request);
    const body = (await result?.json()) as Record<string, unknown>;
    expect(body.retryAfter).toBeDefined();
    expect(typeof body.retryAfter).toBe("number");
  });

  it("sets Content-Type to application/json", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 1,
      windowSeconds: 60,
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    // First request
    await limiter.enforce(request);

    // Second request (exceeds limit)
    const result = await limiter.enforce(request);
    expect(result?.headers.get("Content-Type")).toBe("application/json");
  });

  it("respects maxRequests configuration", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 3,
      windowSeconds: 60,
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    // Make 3 requests (should all succeed)
    for (let i = 0; i < 3; i++) {
      const result = await limiter.enforce(request);
      expect(result).toBeNull();
    }

    // 4th request should fail
    const result = await limiter.enforce(request);
    expect(result?.status).toBe(429);
  });

  it("respects windowSeconds configuration", async () => {
    const kv = new MockKV();
    const limiter = createRateLimiter(kv as any, {
      maxRequests: 1,
      windowSeconds: 1, // 1 second window
    });
    const request = new Request("https://example.com/api/test", {
      headers: { "CF-Connecting-IP": "192.168.1.1" },
    });

    // First request
    const result1 = await limiter.enforce(request);
    expect(result1).toBeNull();

    // Second request immediately (should fail)
    const result2 = await limiter.enforce(request);
    expect(result2?.status).toBe(429);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Third request after window (should succeed)
    const result3 = await limiter.enforce(request);
    expect(result3).toBeNull();
  });
});
