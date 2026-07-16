export interface ServiceBinding {
  fetch(request: Request | string, init?: RequestInit): Promise<Response>;
}

export interface AuthenticatedServiceEnv {
  INTERNAL_KEY_BINDING?: string;
}

export class ServiceAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ServiceAuthError";
  }
}

/**
 * serviceFetch with fail-closed internal auth.
 * Injects X-Internal-Auth-Key from env.INTERNAL_KEY_BINDING.
 */
export function authenticatedServiceFetch<E extends AuthenticatedServiceEnv>(
  binding: ServiceBinding,
  env: E,
  path: string,
  body?: unknown,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    timeout?: number;
    /** Override env key (e.g. TELEGRAM_INTERNAL_KEY_BINDING, AGENT_INTERNAL_KEY) */
    internalKey?: string;
  }
): Promise<Response> {
  const key = options?.internalKey ?? env.INTERNAL_KEY_BINDING;
  if (!key) {
    return Promise.reject(
      new ServiceAuthError("INTERNAL_KEY_BINDING not configured")
    );
  }
  return serviceFetch(binding, path, body, {
    method: options?.method,
    timeout: options?.timeout,
    headers: {
      ...options?.headers,
      "X-Internal-Auth-Key": key,
    },
  });
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
