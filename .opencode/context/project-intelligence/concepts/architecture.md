<!-- Context: project-intelligence/concepts | Priority: critical | Version: 1.0 | Updated: 2026-05-03 -->

# Architecture

**Concept**: Hoox is a Cloudflare Edge Worker platform where `hoox` gateway routes external requests to internal workers via Service Bindings. Dashboard uses Next.js 16 + OpenNext deployed to Cloudflare Workers.

## Key Points
- **Gateway pattern**: `hoox` validates API keys, then forwards to `trade-worker`, `telegram-worker`, etc.
- **Inter-worker comms**: Service Bindings + `internalAuthKey` header for internal auth
- **Storage**: D1 (SQL), R2 (files), KV (config), Durable Objects (idempotency), Queues (async)
- **Cron**: `agent-worker` runs every 5 min for AI risk management

## Worker Map
| Worker | Role | Cron | Public |
|--------|------|------|--------|
| hoox | Gateway entry point | No | ✅ |
| trade-worker | Multi-exchange execution | No | ❌ |
| agent-worker | AI risk manager | ✅ (*/5) | ❌ |
| telegram-worker | Notifications | No | ❌ |
| d1-worker | Database operations | No | ❌ |
| web3-wallet-worker | DeFi/on-chain | No | ❌ |
| email-worker | Email parsing | No | ❌ |

## 📂 Codebase References
**Gateway**: `workers/hoox/src/index.ts` - Request routing logic
**Config**: `workers.jsonc` - Central worker configuration
