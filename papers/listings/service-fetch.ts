// Source: packages/shared/src/service-bindings.ts (lines 5-25)
// Listing id: service-fetch
// Caption: Service Binding fetch helper with 30s timeout
export function serviceFetch(
  binding: ServiceBinding,
  path: string,
  body?: unknown,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    timeout?: number;
  }
): Promise<Response> {
  const timeout = options?.timeout ?? 30000;
  return binding.fetch(`http://internal${path}`, {
    method: options?.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeout),
  });
}
