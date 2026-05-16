/**
 * Router implementation for Cloudflare Workers
 * Provides standardized routing across all workers with path parameter support
 *
 * Supports exact matching (fast path) and pattern matching for `:param` segments.
 * Path parameters are extracted and passed as the 4th argument to handlers.
 */

import type {
  Handler,
  RouteDefinition,
  RouteParams,
  Router,
} from "./types/router";

// Re-export types for convenience — consumers can import from "router.ts" as well
export type { Handler, RouteParams } from "./types/router";

export function createRouter<TEnv = Record<string, unknown>>(): Router<TEnv> {
  const routes: RouteDefinition<TEnv>[] = [];

  /**
   * Extract param names from a path pattern like `/users/:userId/posts/:postId`
   */
  function extractParams(pattern: string): string[] {
    const params: string[] = [];
    const regex = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;
    while ((match = regex.exec(pattern)) !== null) {
      params.push(match[1]);
    }
    return params;
  }

  /**
   * Convert a path pattern with `:param` placeholders into a RegExp
   * for matching against actual request paths.
   * Regex-special characters in the pattern are escaped first.
   */
  function patternToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regexStr = escaped.replace(/:([a-zA-Z_][a-zA-Z0-9_]*)/g, "([^/]+)");
    return new RegExp(`^${regexStr}$`);
  }

  /**
   * Match a request path against a pattern with named params.
   * Returns extracted params or null if no match.
   */
  function matchPattern(
    path: string,
    pattern: string,
    paramNames: string[]
  ): RouteParams | null {
    const regex = patternToRegex(pattern);
    const m = path.match(regex);
    if (!m) return null;

    const params: RouteParams = {};
    for (let i = 0; i < paramNames.length; i++) {
      params[paramNames[i]] = m[i + 1];
    }
    return params;
  }

  /**
   * Register a route with optional param extraction from the path pattern.
   */
  function addRoute(
    path: string,
    method: string,
    handler: Handler<TEnv>,
    middleware?: Handler<TEnv>[]
  ): void {
    const paramNames = extractParams(path);
    const route: RouteDefinition<TEnv> = { path, method, handler, middleware };
    if (paramNames.length > 0) {
      route.params = paramNames;
    }
    routes.push(route);
  }

  /**
   * Match a request path + method against registered routes.
   * 1. Try exact match first (fast path — no overhead for static routes)
   * 2. Fall back to pattern matching for routes with `:param` segments
   *
   * Returns the matched route and any extracted params.
   */
  function matchRoute(
    path: string,
    method: string
  ): { route: RouteDefinition<TEnv>; params?: RouteParams } | null {
    // Fast path: exact match
    const exact = routes.find((r) => r.path === path && r.method === method);
    if (exact) return { route: exact };

    // Pattern match: iterate routes with params
    for (const route of routes) {
      if (route.params && route.params.length > 0) {
        const matched = matchPattern(path, route.path, route.params);
        if (matched && route.method === method) {
          return { route, params: matched };
        }
      }
    }

    return null;
  }

  return {
    get(
      path: string,
      handler: Handler<TEnv>,
      middleware?: Handler<TEnv>[]
    ): void {
      addRoute(path, "GET", handler, middleware);
    },

    post(
      path: string,
      handler: Handler<TEnv>,
      middleware?: Handler<TEnv>[]
    ): void {
      addRoute(path, "POST", handler, middleware);
    },

    put(
      path: string,
      handler: Handler<TEnv>,
      middleware?: Handler<TEnv>[]
    ): void {
      addRoute(path, "PUT", handler, middleware);
    },

    delete(
      path: string,
      handler: Handler<TEnv>,
      middleware?: Handler<TEnv>[]
    ): void {
      addRoute(path, "DELETE", handler, middleware);
    },

    async handle(
      request: Request,
      env: TEnv,
      ctx: ExecutionContext
    ): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      const match = matchRoute(path, method);
      if (!match) {
        // Check if path exists with a different method → 405
        const pathExists = routes.some((r) => {
          if (r.path === path) return true;
          if (r.params && r.params.length > 0) {
            return patternToRegex(r.path).test(path);
          }
          return false;
        });
        if (pathExists) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Method ${method} not allowed for ${path}`,
            }),
            {
              status: 405,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
        return new Response(
          JSON.stringify({ success: false, error: "Not found" }),
          {
            status: 404,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      // Apply middleware if any (middleware receives request, env, ctx — no params)
      if (match.route.middleware) {
        for (const mw of match.route.middleware) {
          const result = await mw(request, env, ctx);
          if (result instanceof Response) return result;
        }
      }

      // Pass extracted params as 4th argument (undefined for exact-match routes)
      return match.route.handler(request, env, ctx, match.params);
    },
  };
}
