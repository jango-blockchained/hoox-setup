/**
 * Router type definitions for standardized worker routing
 * Compatible with Cloudflare Workers edge runtime
 */

export type Handler<TEnv = Record<string, unknown>> = (
  request: Request,
  env: TEnv,
  ctx: ExecutionContext
) => Promise<Response>;

export interface RouteDefinition<TEnv = Record<string, unknown>> {
  path: string;
  method: string;
  handler: Handler<TEnv>;
  middleware?: Handler<TEnv>[];
}

export interface Router<TEnv = Record<string, unknown>> {
  get(path: string, handler: Handler<TEnv>, middleware?: Handler<TEnv>[]): void;
  post(path: string, handler: Handler<TEnv>, middleware?: Handler<TEnv>[]): void;
  put(path: string, handler: Handler<TEnv>, middleware?: Handler<TEnv>[]): void;
  delete(path: string, handler: Handler<TEnv>, middleware?: Handler<TEnv>[]): void;
  handle(request: Request, env: TEnv, ctx: ExecutionContext): Promise<Response>;
}
