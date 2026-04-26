# Skills

This project defines specialized skills for AI agents working on the Hoox trading system.

## Available Skills

### hoox-development

**Purpose:** Guide for developing and modifying the Hoox trading system workers.

**Triggers:** When working on worker code, making changes to workers/, or asking about worker architecture.

**Instructions:**
1. Read AGENTS.md for full architecture documentation
2. Workers are located in `workers/` directory
3. Dashboard is in `pages/dashboard/` (Cloudflare Pages, NOT a Worker)
4. Key entry points are in each worker's `src/index.ts`
5. Configuration is in `wrangler.jsonc` per worker
6. Use `bun run scripts/manage.ts workers dev <worker-name>` for local testing
7. Deploy with `bun run scripts/manage.ts workers deploy <worker-name>`

**Files:**
- AGENTS.md - Full system documentation
- workers/*/src/index.ts - Worker entry points
- workers/*/wrangler.jsonc - Worker configuration

---

### deployment

**Purpose:** Guide for deploying workers to Cloudflare.

**Triggers:** When deploying workers, running CI/CD, or asking about deployment process.

**Instructions:**
1. All workers must be cloned to `workers/` directory first
2. Use `bun run scripts/manage.ts workers deploy` to deploy all
3. Use `bun run scripts/manage.ts workers deploy <name>` for single worker
4. Check worker status with `bun run scripts/manage.ts workers status`
5. View live logs with `bunx wrangler tail <worker-name>`

**Commands:**
```bash
bun run scripts/manage.ts workers deploy          # Deploy all workers
bun run scripts/manage.ts workers deploy hoox    # Deploy single worker
bun run scripts/manage.ts workers status         # Check status
bunx wrangler tail hoox                         # View live logs
```

---

### troubleshooting

**Purpose:** Guide for diagnosing and fixing issues in the Hoox system.

**Triggers:** When debugging errors, fixing bugs, or investigating failures.

**Instructions:**
1. Check system logs: `GET /api/logs` on d1-worker
2. Run housekeeping: `bun run scripts/manage.ts housekeeping`
3. Verify worker health: `GET /health` on each worker
4. Check KV config: Look at `CONFIG_KV` bindings
5. Common issues:
   - Rate limiting: Check `kill_switch` in KV
   - Failed trades: Check queue dead letter
   - Exchange errors: Check R2 reports bucket

**Endpoints:**
- `GET /health` - Worker health check (all workers)
- `GET /api/logs?limit=50` - Recent system logs
- `POST /agent/housekeeping` - Run health checks

---

### database

**Purpose:** Guide for working with D1 database operations.

**Triggers:** When querying trade data, modifying schema, or adding database operations.

**Instructions:**
1. Database ID: `a682f084-594e-4bd8-be2d-40ea5f8cf42e`
2. Direct queries via `workers/d1-worker/src/index.ts`
3. Schema defined in `workers/trade-worker/schema.sql`
4. Key tables:
   - `trade_signals` - Incoming signals
   - `trades` - Executed trades
   - `positions` - Active positions
   - `balances` - Balance snapshots
   - `system_logs` - Observability

**Schema Location:** `workers/trade-worker/schema.sql`

---

### security

**Purpose:** Guide for security-related modifications and validation.

**Triggers:** When modifying auth, adding endpoints, or changing security settings.

**Instructions:**
1. All inter-worker communication uses `X-Internal-Auth-Key` header
2. Dashboard uses httpOnly cookie sessions (24hr expiry)
3. hoox validates `apiKey` in webhook payloads
4. IP allowlisting configured in `CONFIG_KV`
5. Secrets stored in Cloudflare Secret Store
6. Never commit secrets or keys to repository
7. Use timing-safe comparison for API key validation

**KV Keys:**
- `webhook:tradingview:ip_check_enabled`
- `webhook:tradingview:allowed_ips`
- `kill_switch`

---

### testing

**Purpose:** Guide for running and writing tests.

**Triggers:** When running tests, adding test coverage, or debugging test failures.

**Instructions:**
1. Run all tests: `bun test`
2. Run worker-specific: `bun test workers/<worker-name>`
3. Watch mode: `bun test:watch`
4. Coverage: Add tests for new features before deploying
5. Test files: `workers/*/test/*.test.ts`

**Commands:**
```bash
bun test                      # Run all tests
bun test workers/hoox        # Test specific worker
bun test:watch               # Watch mode
```

---

### configuration

**Purpose:** Guide for understanding and modifying system configuration.

**Triggers:** When changing settings, adding environment variables, or configuring workers.

**Instructions:**
1. Global config: `config.toml` or `workers.jsonc`
2. Worker config: `workers/*/wrangler.jsonc`
3. Secrets: Use `wrangler secret put <name> --worker <worker>`
4. KV settings: Stored in `CONFIG_KV` namespace
5. Environment vars for Pages: `pages.jsonc`

**Configuration Files:**
- `config.toml` - Global settings
- `workers.jsonc` - Worker configurations
- `workers/*/wrangler.jsonc` - Per-worker settings
- `pages.jsonc` - Dashboard/Pages settings