/**
 * Router type definitions for standardized worker routing
 * Compatible with Cloudflare Workers edge runtime
 */

export type RouteParams = Record<string, string>;

export type Handler<TEnv = any> = (
  request: Request,
  env: TEnv,
  ctx: ExecutionContext,
  params?: RouteParams
) => Promise<Response | void>;

export interface RouteDefinition<TEnv = any> {
  path: string;
  method: string;
  handler: Handler<TEnv>;
  middleware?: Handler<TEnv>[];
  params?: string[];
  regex?: RegExp;
}

export interface Router<TEnv = any> {
  get(path: string, handler: Handler<TEnv>, middleware?: Handler<TEnv>[]): void;
  post(
    path: string,
    handler: Handler<TEnv>,
    middleware?: Handler<TEnv>[]
  ): void;
  put(path: string, handler: Handler<TEnv>, middleware?: Handler<TEnv>[]): void;
  delete(
    path: string,
    handler: Handler<TEnv>,
    middleware?: Handler<TEnv>[]
  ): void;
  handle(request: Request, env: TEnv, ctx: ExecutionContext): Promise<Response>;
}
