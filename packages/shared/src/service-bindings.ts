/**
 * Standardized helper for inter-worker service binding calls.
 *
 * Uses `Fetcher.fetch(url, init)` directly — avoids the `as unknown as Request`
 * anti-pattern and inconsistent URL schemes used across workers
 * (http://trade-service/webhook, http://localhost/query, https://internal/webhook, etc.).
 *
 * Convention: URL path matches the route the target worker serves.
 * Defaults to POST with JSON Content-Type body.
 *
 * Note: Uses `any` for the binding parameter to avoid `@cloudflare/workers-types`
 * `Fetcher` type incompatibilities that can arise when different workspace
 * packages resolve distinct instances of the types package. At runtime, service
 * bindings from the Workers runtime always have a compatible `fetch` method.
 *
 * @example
 *   // POST with JSON body (default)
 *   const response = await serviceFetch(env.TRADE_SERVICE, "/webhook", payload);
 *
 *   // POST with extra headers
 *   const response = await serviceFetch(env.D1_SERVICE, "/query", { query, params }, {
 *     headers: { "X-Request-ID": requestId },
 *   });
 *
 *   // GET request (no body)
 *   const response = await serviceFetch(env.D1_SERVICE, "/health", undefined, { method: "GET" });
 */
export function serviceFetch(
  binding: any,
  path: string,
  body?: unknown,
  options?: { method?: string; headers?: Record<string, string> }
): Promise<Response> {
  return binding.fetch(`http://internal${path}`, {
    method: options?.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
}
