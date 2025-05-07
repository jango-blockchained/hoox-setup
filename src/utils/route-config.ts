/**
 * Route configuration types and helpers for the dynamic routing system.
 * These configurations will be stored in KV and used by webhook-receiver to route requests.
 */

/**
 * Configuration for a single route.
 */
export interface RouteConfig {
  worker: string; // Target worker service binding name
  path: string; // Target endpoint path within worker
  requiresAuth: boolean; // Whether API key auth is required
  methods: string[]; // Allowed HTTP methods
  transforms?: {
    // Optional payload transformations
    request?: string; // Transform function name for request
    response?: string; // Transform function name for response
  };
  description?: string; // Optional description of the route
  version?: string; // API version this route belongs to
  tags?: string[]; // Optional tags for categorization
}

/**
 * Full routes configuration stored in KV.
 */
export interface RoutesConfig {
  routes: Record<string, RouteConfig>;
  lastUpdated: string; // ISO timestamp
}

/**
 * Default route configuration for fallback.
 */
export const DEFAULT_ROUTES_CONFIG: RoutesConfig = {
  routes: {},
  lastUpdated: new Date().toISOString(),
};

/**
 * KV key for route configuration.
 */
export const ROUTES_CONFIG_KEY = "routes:config";

/**
 * Validates that a route configuration is valid.
 */
export function validateRouteConfig(route: RouteConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!route.worker) {
    errors.push("Missing required field: worker");
  }

  if (!route.path) {
    errors.push("Missing required field: path");
  }

  if (
    !route.methods ||
    !Array.isArray(route.methods) ||
    route.methods.length === 0
  ) {
    errors.push("Methods must be a non-empty array");
  } else {
    const validMethods = [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "PATCH",
      "OPTIONS",
      "HEAD",
    ];
    for (const method of route.methods) {
      if (!validMethods.includes(method.toUpperCase())) {
        errors.push(`Invalid HTTP method: ${method}`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
