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
  checkInternalAuth,
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
