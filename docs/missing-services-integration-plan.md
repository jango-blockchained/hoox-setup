# Integration Plan: Missing Cloudflare Services

**Date:** 2026-05-12 | **Status:** Planning  
**Source:** Full codebase audit of 9 workers × 13 Cloudflare services

---

## Audit Summary

| Service | Status | Effort |
|---------|:------:|:------:|
| Workers AI | ✅ Integrated | — |
| Vectorize | ✅ Integrated | — |
| Analytics Engine | ✅ Integrated | — |
| Observability | ✅ Integrated | — |
| WAF (CLI) | ✅ Integrated | — |
| Durable Objects | 🔶 Partial (hoox stub) | Medium |
| AI Gateway | 🔶 Partial (no binding) | Low |
| **Smart Placement** | ❌ Missing | **Trivial** |
| **Tail Workers** | ❌ Missing | Low |
| **Rate Limiting (native)** | ❌ Missing | Low |
| **Browser Rendering** | ❌ Missing | Medium |
| **Hyperdrive** | ❌ Missing | Medium |

---

## Task 1: Smart Placement (Trivial — 1 line per worker)

**Cost:** $0 (free on all plans)  
**Impact:** 30-60% latency reduction for exchange API calls

Add `[placement] mode = "smart"` to these workers' `wrangler.jsonc`:

- `workers/hoox/wrangler.jsonc` (needs creation from `.example`)
- `workers/trade-worker/wrangler.jsonc`
- `workers/agent-worker/wrangler.jsonc`
- `workers/d1-worker/wrangler.jsonc`
- `workers/telegram-worker/wrangler.jsonc`

```toml
[placement]
mode = "smart"
```

---

## Task 2: Durable Objects — Real Idempotency Locks (Medium)

**Cost:** $0 (free on all plans, SQLite storage)  
**Impact:** Exactly-once trade execution, stronger than current best-effort

### 2.1 Create hoox `wrangler.jsonc`

The hoox worker is missing its actual `wrangler.jsonc`. Copy the `.example` file:

```bash
cp workers/hoox/wrangler.jsonc.example workers/hoox/wrangler.jsonc
```

Verify these bindings are present:
- `ai` binding (Workers AI)
- `durable_objects` with `IDEMPOTENCY_STORE`
- `services` (TRADE_SERVICE, TELEGRAM_SERVICE, ANALYTICS_SERVICE)
- `kv_namespaces` (SESSIONS_KV, CONFIG_KV)
- `queues.producers` (TRADE_QUEUE)
- `vectorize` (VECTORIZE_INDEX)

### 2.2 Implement Real DO Lock Class

Replace the stub in `workers/hoox/src/idempotencyStore.ts`:

```typescript
import { DurableObject } from "cloudflare:workers";

export class IdempotencyStore extends DurableObject {
  async checkAndStore(key: string, ttlMs = 300_000): Promise<boolean> {
    const existing = await this.ctx.storage.get<{ storedAt: number }>(key);
    if (existing && Date.now() - existing.storedAt < ttlMs) return false;
    await this.ctx.storage.put(key, { storedAt: Date.now() });
    // Auto-cleanup via alarm
    await this.ctx.storage.setAlarm(Date.now() + ttlMs);
    return true;
  }

  async alarm(): Promise<void> {
    // Clean up expired keys
    const all = await this.ctx.storage.list();
    const now = Date.now();
    for (const [key, val] of all) {
      if (now - (val as { storedAt: number }).storedAt > 300_000) {
        await this.ctx.storage.delete(key);
      }
    }
  }
}
```

---

## Task 3: Tail Workers — Real-time Observability Pipeline (Low)

**Cost:** $0 (available on Workers Paid)  
**Impact:** Forward trade execution events to external monitoring

### 3.1 Configure `analytics-worker` as Tail Consumer

Add to each producer worker's `wrangler.jsonc`:

```toml
tail_consumers = [{ service = "analytics-worker" }]
```

Workers to instrument: `hoox`, `trade-worker`, `agent-worker`, `telegram-worker`

### 3.2 Implement Tail Handler

Add to `workers/analytics-worker/src/index.ts`:

```typescript
export default {
  async tail(events: TailItems, env: Env, ctx: ExecutionContext) {
    for (const event of events) {
      env.ANALYTICS_ENGINE.writeDataPoint({
        blobs: [event.scriptName, event.outcome],
        doubles: [event.eventTimestamp],
        indexes: ["tail_events"],
      });
    }
  },
};
```

---

## Task 4: Native Rate Limiting — Gateway API Protection (Low)

**Cost:** $0 (1 free rule)  
**Impact:** Protect `hoox` gateway from abuse with Cloudflare's native rate limiter

Add to `workers/hoox/wrangler.jsonc`:

```toml
[[unsafe.bindings]]
type = "ratelimit"
name = "API_RATE_LIMITER"
namespace_id = "1001"
limit = 100
period = 60
```

Add middleware usage in `workers/hoox/src/index.ts`:

```typescript
const { success } = await env.API_RATE_LIMITER.limit({ key: apiKey });
if (!success) {
  return new Response(JSON.stringify({ error: "Rate limit exceeded" }), { status: 429 });
}
```

---

## Task 5: Browser Rendering — Automated PDF Reports (Medium)

**Cost:** $0 (10 min/day free)  
**Impact:** Server-side PDF portfolio/performance reports

### 5.1 Create `workers/report-worker`

New worker directory with `wrangler.jsonc`:

```toml
name = "report-worker"
main = "src/index.ts"
compatibility_date = "2025-03-07"

[[r2_buckets]]
binding = "REPORTS_BUCKET"
bucket_name = "hoox-reports"

[browsers]
binding = "BROWSER"
```

### 5.2 Implement PDF Generation

```typescript
export default {
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const browser = await env.BROWSER.start();
    const page = await browser.newPage();
    await page.setContent(buildReportHTML());
    const pdf = await page.pdf({ format: "A4" });
    await env.REPORTS_BUCKET.put(`reports/daily-${Date.now()}.pdf`, pdf);
    await browser.close();
  },
};
```

### 5.3 Add to Telegram Delivery

Update `telegram-worker` to send report links via `telegram-worker` + R2 presigned URLs.

---

## Task 6: Hyperdrive — DB Acceleration (Medium)

**Cost:** $5/mo (paid add-on)  
**Impact:** Faster D1 queries, connection pooling

Add to `workers/d1-worker/wrangler.jsonc`:

```toml
[[hyperdrive]]
binding = "HYPERDRIVE"
id = "hoox-db-hyperdrive"
```

---

## Implementation Order

| Priority | Task | Effort | Cumulative Cost |
|----------|------|--------|:---:|
| 1 | Smart Placement (5 workers) | 1 line × 5 files | $0 |
| 2 | hoox `wrangler.jsonc` restoration | Copy .example | $0 |
| 3 | Real DO Idempotency Locks | ~50 lines | $0 |
| 4 | Native Rate Limiting | ~10 lines config + ~5 lines code | $0 |
| 5 | Tail Workers observability | ~10 lines config + ~15 lines code | $0 |
| 6 | Browser Rendering reports | New worker (~100 lines) | $0 |
| 7 | Hyperdrive DB acceleration | ~5 lines config | $5/mo |

**Total new monthly cost: $5/mo** (Hyperdrive is the only paid add-on among missing services)
