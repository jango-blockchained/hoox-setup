import { collectInternalAuthKeys } from "./middleware/auth";
import type { InternalAuthEnv, InternalAuthKeyName } from "./middleware/auth";

export interface ServiceBinding {
  fetch(request: Request | string, init?: RequestInit): Promise<Response>;
}

/** Env binding names for scoped internal auth keys. */
export const InternalAuthKeyFields = {
  DEFAULT: "INTERNAL_KEY_BINDING",
  D1_READ: "D1_READ_KEY_BINDING",
  D1_WRITE: "D1_WRITE_KEY_BINDING",
} as const;

/** d1-worker read routes: prefer read-only key, fall back to legacy full key. */
export const D1_READ_AUTH_KEY_FIELDS = [
  InternalAuthKeyFields.D1_READ,
  InternalAuthKeyFields.DEFAULT,
] as const;

/** d1-worker write/RPC routes: prefer write key, fall back to legacy full key. */
export const D1_WRITE_AUTH_KEY_FIELDS = [
  InternalAuthKeyFields.D1_WRITE,
  InternalAuthKeyFields.DEFAULT,
] as const;

/** First configured key from an ordered fallback list. */
export function resolveInternalAuthKey(
  env: object,
  keyFields: InternalAuthKeyName
): string | undefined {
  return collectInternalAuthKeys(env as InternalAuthEnv, keyFields)[0];
}

export interface AuthenticatedServiceEnv {
  INTERNAL_KEY_BINDING?: string;
  D1_READ_KEY_BINDING?: string;
  D1_WRITE_KEY_BINDING?: string;
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
    /** Ordered env fields to try when internalKey is not set */
    internalKeyFields?: InternalAuthKeyName;
  }
): Promise<Response> {
  const key =
    options?.internalKey ??
    (options?.internalKeyFields
      ? resolveInternalAuthKey(env, options.internalKeyFields)
      : env.INTERNAL_KEY_BINDING);
  if (!key) {
    const label = options?.internalKeyFields
      ? Array.isArray(options.internalKeyFields)
        ? options.internalKeyFields.join(" | ")
        : options.internalKeyFields
      : "INTERNAL_KEY_BINDING";
    return Promise.reject(new ServiceAuthError(`${label} not configured`));
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
