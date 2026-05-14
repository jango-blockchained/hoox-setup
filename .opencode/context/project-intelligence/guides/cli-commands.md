# CLI Command Reference

The `hoox` CLI is the central management tool for the Hoox Trading System. Built with commander.js and Bun.

## Complete Command Tree

```
hoox
├── init                          Interactive setup wizard with AI provider support
├── clone                         Clone worker repos as git submodules
├── dev                           Local development (native/docker runtime)
├── deploy                        Deploy workers and dashboard
│   ├── all                       Deploy all enabled workers + dashboard
│   │   --auto                    Skip rebuild prompt, deploy existing build
│   │   --rebuild                 Force rebuild dashboard
│   ├── workers                   Deploy all workers (skip dashboard)
│   ├── worker <name>             Deploy a single worker
│   ├── dashboard                 Build and deploy Next.js dashboard
│   ├── telegram-webhook          Set Telegram bot webhook (post-deploy)
│   │   --token                   Bot token override
│   │   --secret-token            Webhook secret override
│   │   --subdomain               Subdomain prefix override
│   ├── update-internal-urls      Update dashboard wrangler.jsonc URLs
│   └── kv-config                 Apply KV manifest defaults post-deploy
├── infra                         Manage Cloudflare infrastructure
│   ├── provision                 Auto-provision from wrangler.jsonc
│   ├── d1                        D1 SQL databases (list/create/delete)
│   ├── kv                        KV namespaces (list/create/delete)
│   ├── r2                        R2 buckets (list/create/delete)
│   ├── queues                    Message queues (list/create/delete)
│   ├── vectorize                 Vector database (list/create/delete)
│   └── analytics                 Analytics Engine (list/create)
├── config                        Manage configuration
│   ├── show                      Display wrangler.jsonc
│   ├── set                       Update config values
│   ├── env                       Environment variables
│   │   ├── init                  Interactive env setup
│   │   ├── show                  Display env vars (secrets redacted)
│   │   ├── validate              Check required vars
│   │   └── generate-dev-vars     Per-worker .dev.vars generation
│   ├── kv                        KV key management
│   │   ├── list                  List keys in CONFIG_KV
│   │   ├── get <key>             Get specific key
│   │   ├── set <key> <value>     Set key value
│   │   ├── delete <key>          Delete key
│   │   ├── apply-manifest        Apply manifest defaults
│   │   └── manifest              Show expected keys
│   └── secrets                   Secret management (sync/rotate)
├── check                         Validation and diagnostics
│   ├── prerequisites             7 tool/account/repo checks
│   ├── setup                     Full setup validation
│   └── health                    Worker health checks
├── db                            D1 database operations
│   ├── apply                     Apply schema.sql (--remote for production)
│   ├── migrate                   Run tracking migrations
│   ├── list                      List database tables
│   ├── query <sql>               Execute read-only query
│   ├── export                    Export to .sql file
│   └── reset                     Drop and recreate (DESTRUCTIVE)
├── monitor                       Operational monitoring
│   ├── status                    Check all worker /health endpoints
│   ├── trades [N]                Recent trades from D1 (default: 10)
│   ├── logs [worker]             System logs from D1
│   ├── kill-switch show|on|off   Emergency trading halt via KV
│   ├── queue-depth               List queues
│   └── backup                    D1 export to timestamped .sql
├── repair                        Repair and recovery
│   ├── check                     Comprehensive system check
│   ├── worker <name>             Redeploy single worker
│   ├── infra                     Verify infrastructure exists
│   ├── secrets                   Re-upload all secrets
│   ├── kv                        Reset KV keys to defaults
│   ├── db                        Re-apply schema + migrations
│   └── rebuild                   Full guided rebuild (interactive)
├── logs                          Tail and view worker logs
├── test                          Run tests and CI pipeline
├── waf                           Cloudflare WAF management
│   ├── status                    Show WAF status for the zone
│   ├── rules                     Manage WAF firewall rules
│   │   ├── list                  List all active firewall rules
│   │   ├── add <type> <value>    Add a WAF rule (ip-allowlist, ip-blocklist, rate-limit, custom)
│   │   └── remove <ruleId>       Remove a WAF rule by ID
│   └── mode                      Enable or disable WAF protection
│       ├── enable                Enable WAF protection
│       └── disable               Disable WAF protection
└── dashboard                     Dashboard operations (update-urls)
```

## Key Patterns

- **Global flags**: `--json` (machine output), `--quiet` (minimal output) — read via `optsWithGlobals()`
- **Service architecture**: Commands delegate to service classes (CloudflareService, DbService, KvSyncService, etc.)
- **Wrangler CLI**: Most infra operations wrap `wrangler` via `Bun.spawn()`
- **Interactive commands**: Use `@clack/prompts` (spinner, confirm, select)
