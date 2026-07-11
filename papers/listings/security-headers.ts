// Source: packages/shared/src/middleware/security-headers.ts (lines 25-45)
// Listing id: security-headers
// Caption: Default security response headers (CSP, HSTS)
export const SECURITY_HEADERS_DEFAULTS: Required<SecurityHeadersOptions> = {
  xContentTypeOptions: "nosniff",
  xFrameOptions: "DENY",
  xXssProtection: "1; mode=block",
  referrerPolicy: "strict-origin-when-cross-origin",
  permissionsPolicy:
    "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
  strictTransportSecurity: "max-age=31536000; includeSubDomains",
  contentSecurityPolicy: "default-src 'self'",
};

/**
 * Create security headers object for use in responses.
 * Merges provided options over defaults.
 */
export function secureHeaders(
  options?: SecurityHeadersOptions
): Record<string, string> {
  const opts = { ...SECURITY_HEADERS_DEFAULTS, ...options };
  const headers: Record<string, string> = {
    "X-Content-Type-Options": opts.xContentTypeOptions,
