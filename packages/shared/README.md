# @hoox/shared

Shared types, custom router, middleware (auth, CORS, rate-limit, logger), error factories, and utilities.

## For CLI Users

This is an internal package — installed automatically as a workspace dependency. No CLI commands needed.

→ [Architecture Overview](../../docs/devops/architecture/overview.md)

## For Operators

This package provides the shared foundation for all Hoox workers. It includes standardized JSON response helpers, KV utility functions, exchange client base classes, common TypeScript types, and middleware components used by the hoox gateway.

→ [Architecture Overview](../../docs/devops/architecture/overview.md)

## Development

```bash
bun test packages/shared
```
