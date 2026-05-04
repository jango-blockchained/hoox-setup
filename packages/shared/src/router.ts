/**
 * Router implementation for Cloudflare Workers
 * Provides standardized routing across all workers
 */

import type { Handler, RouteDefinition, Router } from './types/router';

export function createRouter<TEnv = Record<string, unknown>>(): Router<TEnv> {
  const routes: RouteDefinition<TEnv>[] = [];

  function matchRoute(path: string, method: string): RouteDefinition<TEnv> | null {
    return routes.find(r => {
      // Support simple path matching (can be extended for params)
      return r.path === path && r.method === method;
    }) ?? null;
  }

  return {
    get(path: string, handler: Handler<TEnv>, middleware?: Handler<TEnv>[]): void {
      routes.push({ path, method: 'GET', handler, middleware });
    },

    post(path: string, handler: Handler<TEnv>, middleware?: Handler<TEnv>[]): void {
      routes.push({ path, method: 'POST', handler, middleware });
    },

    put(path: string, handler: Handler<TEnv>, middleware?: Handler<TEnv>[]): void {
      routes.push({ path, method: 'PUT', handler, middleware });
    },

    delete(path: string, handler: Handler<TEnv>, middleware?: Handler<TEnv>[]): void {
      routes.push({ path, method: 'DELETE', handler, middleware });
    },

    async handle(request: Request, env: TEnv, ctx: ExecutionContext): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname;
      const method = request.method;

      const route = matchRoute(path, method);
      if (!route) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Apply middleware if any
      if (route.middleware) {
        for (const mw of route.middleware) {
          const result = await mw(request, env, ctx);
          if (result instanceof Response) return result;
        }
      }

      return route.handler(request, env, ctx);
    },
  };
}
