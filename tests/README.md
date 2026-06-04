# Tests Directory

## integration/

Vitest-based integration tests using @cloudflare/vitest-pool-workers.
Tests middleware composition, service binding interactions, and gateway routing.
Run: `bun test tests/integration/`

## e2e/

End-to-end tests with mocked service bindings.
Tests complete signal flow through the system.
Run: `bun test tests/e2e/`

## live/

Live Cloudflare API tests (requires valid credentials).
Skipped gracefully via describe.skip when env vars missing.
Run: `bun test tests/live/ --jobs 1`

## security/

Security/fuzz tests for auth bypass, headers, and input fuzzing.
Run: `bun test tests/security/`

## load/

k6 load testing scripts (NOT bun tests).
Run: `bun run test:load`
