/**
 * Barrel exports for shared middleware
 */

export {
  createLogger,
  withRequestLog,
  type Logger,
  type LogContext,
} from "./logger";
export {
  requireAuth,
  requireInternalAuth,
  createInternalAuthMiddleware,
  checkInternalAuth,
  timingSafeEqual,
  type InternalAuthEnv,
} from "./auth";
export {
  createRateLimiter,
  type RateLimiter,
  type RateLimitConfig,
} from "./rate-limit";
export {
  validateJson,
  validateJsonLegacy,
  requireField,
  optionalField,
} from "./validate";
export {
  corsHeaders,
  handleCorsPreflightRequest,
  type CorsOptions,
} from "./cors";
export {
  secureHeaders,
  wrapWithSecurityHeaders,
  type SecurityHeadersOptions,
  SECURITY_HEADERS_DEFAULTS,
} from "./security-headers";
