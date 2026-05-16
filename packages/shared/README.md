# @hoox/shared

Shared types, custom router with path parameter support (`:param` syntax), middleware (auth, CORS, rate-limit, logger), error factories (`Errors.*`), generic exchange provider factory (`ExchangeRouter`, `IExchangeProvider`), and utilities.

## For CLI Users

This is an internal package — installed automatically as a workspace dependency. No CLI commands needed.

→ [Architecture Overview](../../docs/devops/architecture/overview.md)

## For Operators

This package provides the shared foundation for all Hoox workers. It includes:

- **Custom Router** — Lightweight routing with exact-match fast path and `:param` path parameter support. Handlers receive extracted params as an optional 4th argument.
- **Error Factories** — `Errors.*` helpers (`badRequest`, `unauthorized`, `forbidden`, `notFound`, `internal`, etc.) for consistent JSON error responses across all workers.
- **Exchange Provider Factory** — Generic `ExchangeRouter<TClient, TEnv>` and `IExchangeProvider<TClient, TEnv>` for registering and resolving exchange clients by name.
- **Middleware** — Logger (`createLogger`, `withRequestLog`), auth (`requireInternalAuth`), CORS, rate limiting, and Zod validation.
- **Utilities** — `toError`, `serviceFetch`, `createJsonResponse`, KV helpers, health check, analytics tracking.

→ [Architecture Overview](../../docs/devops/architecture/overview.md)

## Development

```bash
bun test packages/shared
```
