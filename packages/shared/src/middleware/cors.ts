/**
 * CORS middleware for Cloudflare Workers
 * Provides standardized CORS headers and preflight handling
 */

export interface CorsOptions {
  /** Allowed origins (default: "*") */
  allowOrigin?: string;
  /** Allowed methods (default: "GET, POST, OPTIONS, PUT, DELETE") */
  allowMethods?: string;
  /** Allowed headers (default: "Content-Type, Authorization, X-Request-ID, X-Internal-Auth-Key") */
  allowHeaders?: string;
  /** Whether to include credentials (default: false) */
  allowCredentials?: boolean;
  /** Max age for preflight cache (default: 86400 = 24h) */
  maxAge?: number;
}

const DEFAULT_OPTIONS: Required<CorsOptions> = {
  allowOrigin: '*',
  allowMethods: 'GET, POST, OPTIONS, PUT, DELETE',
  allowHeaders: 'Content-Type, Authorization, X-Request-ID, X-Internal-Auth-Key',
  allowCredentials: false,
  maxAge: 86400,
};

/**
 * Create CORS headers object for use in responses.
 */
export function corsHeaders(options?: CorsOptions): Record<string, string> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const headers: Record<string, string> = {
    'Access-Control-Allow-Origin': opts.allowOrigin,
    'Access-Control-Allow-Methods': opts.allowMethods,
    'Access-Control-Allow-Headers': opts.allowHeaders,
    'Access-Control-Max-Age': String(opts.maxAge),
  };
  if (opts.allowCredentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }
  return headers;
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 * Returns a Response for OPTIONS, or null for non-OPTIONS requests.
 */
export function handleCorsPreflightRequest(
  request: Request,
  options?: CorsOptions,
): Response | null {
  if (request.method !== 'OPTIONS') return null;

  return new Response(null, {
    status: 204,
    headers: corsHeaders(options),
  });
}