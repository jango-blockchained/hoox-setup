export interface ServiceBinding {
  fetch(request: Request | string, init?: RequestInit): Promise<Response>;
}

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
