/**
 * Unit tests for KV utility functions
 * Run with: bun test packages/shared/tests/kvUtils.test.ts
 */

import { describe, test, expect, mock } from "bun:test";
import {
  logKvTimestamp,
  headersToObject,
  kvTimestampMiddleware,
} from "../src/kvUtils";

/**
 * Creates a mock KV namespace for testing KV utility functions.
 * Backed by an in-memory store with tracked put/get operations.
 */
function createMockKv() {
  const store = new Map<string, string>();
  return {
    get: mock((key: string): Promise<string | null> => {
      return Promise.resolve(store.get(key) ?? null);
    }),
    put: mock(
      (
        key: string,
        value: string,
        options?: { expirationTtl?: number },
      ): Promise<void> => {
        store.set(key, value);
        return Promise.resolve();
      },
    ),
    _store: store,
  };
}

describe("KV Utilities", () => {
  describe("logKvTimestamp", () => {
    test("writes to KV with correct key format", async () => {
      const kv = createMockKv();
      const env = { REPORT_KV: kv };

      await logKvTimestamp(env, "test-prefix");

      // Verify put was called
      expect(kv.put.mock.calls.length).toBe(1);

      // Key format should be: {prefix}_{ISO timestamp}
      const putKey = kv.put.mock.calls[0][0] as string;
      expect(putKey).toStartWith("test-prefix_");

      // Value should be a valid ISO timestamp
      const putValue = kv.put.mock.calls[0][1] as string;
      expect(() => new Date(putValue)).not.toThrow();
      expect(new Date(putValue).toISOString()).toBe(putValue);
    });

    test("uses default prefix 'timestamp' when not specified", async () => {
      const kv = createMockKv();
      const env = { REPORT_KV: kv };

      await logKvTimestamp(env);

      // Should use default prefix "timestamp"
      const putKey = kv.put.mock.calls[0][0] as string;
      expect(putKey).toStartWith("timestamp_");
    });

    test("handles KV put errors gracefully", async () => {
      const errorKv = {
        get: mock(() => Promise.resolve(null)),
        put: mock(() => Promise.reject(new Error("KV write failed"))),
      };
      const env = { REPORT_KV: errorKv };

      // Should not throw despite put rejection
      await expect(logKvTimestamp(env, "error-test")).resolves.toBeUndefined();

      // Verify put was attempted
      expect(errorKv.put.mock.calls.length).toBe(1);
    });
  });

  describe("headersToObject", () => {
    test("converts Headers to plain object", () => {
      const headers = new Headers({
        "Content-Type": "application/json",
        "X-Custom-Header": "test-value",
        Authorization: "Bearer token123",
      });

      const obj = headersToObject(headers);

      // Headers are normalized to lowercase by the Headers API
      expect(obj["content-type"]).toBe("application/json");
      expect(obj["x-custom-header"]).toBe("test-value");
      expect(obj["authorization"]).toBe("Bearer token123");
    });

    test("handles null input (returns {})", () => {
      const obj = headersToObject(null);
      expect(obj).toEqual({});
    });

    test("handles undefined input (returns {})", () => {
      const obj = headersToObject(undefined);
      expect(obj).toEqual({});
    });

    test("handles empty Headers object", () => {
      const headers = new Headers();
      const obj = headersToObject(headers);
      expect(obj).toEqual({});
    });

    test("preserves all header entries", () => {
      const headers = new Headers([
        ["X-One", "1"],
        ["X-Two", "2"],
        ["X-Three", "3"],
      ]);

      const obj = headersToObject(headers);

      expect(Object.keys(obj).length).toBe(3);
      expect(obj["x-one"]).toBe("1");
      expect(obj["x-two"]).toBe("2");
      expect(obj["x-three"]).toBe("3");
    });
  });

  describe("kvTimestampMiddleware", () => {
    test("returns a function", () => {
      const middleware = kvTimestampMiddleware();
      expect(typeof middleware).toBe("function");
    });

    test("returns an async function", () => {
      const middleware = kvTimestampMiddleware();
      // Verify it's a function that returns a promise (async)
      const result = middleware({ env: {} }, async () => {});
      expect(result).toBeInstanceOf(Promise);
    });

    test("calls logKvTimestamp and next()", async () => {
      const kv = createMockKv();
      const env = { REPORT_KV: kv };
      let nextCalled = false;
      const next = mock(async () => {
        nextCalled = true;
      });

      const middleware = kvTimestampMiddleware();
      await middleware({ env }, next);

      // Verify KV was written to (logKvTimestamp effect)
      expect(kv.put.mock.calls.length).toBe(1);
      expect(kv.put.mock.calls[0][0] as string).toStartWith("timestamp_");

      // Verify next was called
      expect(nextCalled).toBe(true);
    });

    test("passes env to logKvTimestamp via c.env", async () => {
      const kv = createMockKv();
      const c = { env: { REPORT_KV: kv } };

      let nextCalled = false;
      const next = mock(async () => {
        nextCalled = true;
      });

      const middleware = kvTimestampMiddleware();
      await middleware(c, next);

      // Verify KV write happened (proves env was passed through)
      expect(kv.put.mock.calls.length).toBe(1);
      expect(nextCalled).toBe(true);
    });
  });
});
