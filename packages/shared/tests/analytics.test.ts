/**
 * Unit tests for analytics tracking utilities
 * Run with: bun test packages/shared/tests/analytics.test.ts
 */

import { describe, test, expect, mock } from "bun:test";
import { trackAnalytics } from "../src/analytics";
import type { AnalyticsEnv } from "../src/analytics";

/**
 * Creates a mock analytics environment with an optional Fetcher service.
 * When ANALYTICS_SERVICE is configured, the mock fetch records all
 * request details for assertion while returning a 200 response.
 */
function createMockEnv(withService: boolean): AnalyticsEnv {
  if (!withService) {
    return {};
  }

  const fetchFn = mock((_request: Request): Promise<Response> => {
    return Promise.resolve(new Response(null, { status: 200 }));
  });

  return {
    ANALYTICS_SERVICE: { fetch: fetchFn } as unknown as Fetcher,
    _fetchMock: fetchFn,
  } as AnalyticsEnv & { _fetchMock: ReturnType<typeof mock> };
}

describe("trackAnalytics", () => {
  test("returns immediately when ANALYTICS_SERVICE is not configured", async () => {
    const env = createMockEnv(false);

    const result = await trackAnalytics(env, "/track/test", { key: "value" });

    expect(result).toBeUndefined();
  });

  test("sends POST request when ANALYTICS_SERVICE is configured", async () => {
    const env = createMockEnv(true) as AnalyticsEnv & {
      _fetchMock: ReturnType<typeof mock>;
    };

    await trackAnalytics(env, "/track/api-call", { action: "test" });

    expect(env._fetchMock.mock.calls.length).toBe(1);
    const request = env._fetchMock.mock.calls[0][0] as Request;
    expect(request.method).toBe("POST");
  });

  test("sends correct Content-Type header", async () => {
    const env = createMockEnv(true) as AnalyticsEnv & {
      _fetchMock: ReturnType<typeof mock>;
    };

    await trackAnalytics(env, "/track/test", { data: 1 });

    const request = env._fetchMock.mock.calls[0][0] as Request;
    expect(request.headers.get("Content-Type")).toBe("application/json");
  });

  test("sends the body as JSON", async () => {
    const env = createMockEnv(true) as AnalyticsEnv & {
      _fetchMock: ReturnType<typeof mock>;
    };
    const payload = { userId: "abc123", event: "page_view" };

    await trackAnalytics(env, "/track/test", payload);

    const request = env._fetchMock.mock.calls[0][0] as Request;
    const bodyText = await request.text();
    const parsedBody = JSON.parse(bodyText);
    expect(parsedBody).toEqual(payload);
  });

  test("sends the correct endpoint path", async () => {
    const env = createMockEnv(true) as AnalyticsEnv & {
      _fetchMock: ReturnType<typeof mock>;
    };
    const endpoint = "/track/api-call";

    await trackAnalytics(env, endpoint, {});

    const request = env._fetchMock.mock.calls[0][0] as Request;
    expect(new URL(request.url).pathname).toBe(endpoint);
  });

  test("handles fetch errors gracefully (never throws)", async () => {
    const fetchFn = mock((_request: Request): Promise<Response> => {
      return Promise.reject(new Error("Network failure"));
    });

    const env = {
      ANALYTICS_SERVICE: { fetch: fetchFn } as unknown as Fetcher,
    };

    // Suppress console.error output during this test
    const originalConsoleError = console.error;
    console.error = mock(() => {});

    try {
      const result = await trackAnalytics(env, "/track/test", {});
      expect(result).toBeUndefined();
    } finally {
      console.error = originalConsoleError;
    }

    // Verify the fetch was attempted
    expect(fetchFn.mock.calls.length).toBe(1);
  });
});
