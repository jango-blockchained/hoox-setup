# 📄 report-worker

> Automated PDF portfolio reports via Cloudflare Browser Rendering

## Overview

`report-worker` generates twice-daily PDF portfolio performance reports. It converts portfolio metrics into styled HTML, renders to PDF via the Cloudflare Browser Rendering REST API, stores in R2, and delivers links via Telegram.

## Features

- **Cron-Triggered**: Runs at 06:00 + 18:00 UTC on a `ScheduledEvent` handler
- **Styled HTML→PDF**: Professional report layout with portfolio value, daily/total P&L, win rate, open positions
- **R2 Storage**: PDFs stored in `trade-reports` bucket with date-based keys (`reports/daily-{timestamp}.pdf`)
- **Telegram Delivery**: Report links sent via `TELEGRAM_SERVICE` service binding
- **Graceful Fallback**: Returns text placeholder when `CF_API_TOKEN` not configured

## Configuration

```jsonc
{
  "name": "report-worker",
  "triggers": { "crons": ["0 8 * * *", "0 18 * * *"] },
  "r2_buckets": [{ "binding": "REPORTS_BUCKET", "bucket_name": "trade-reports" }],
  "services": [{ "binding": "TELEGRAM_SERVICE", "service": "telegram-worker" }],
  "vars": { "CF_API_TOKEN_BINDING": null },
  "placement": { "mode": "smart" },
  "observability": { "enabled": true, "head_sampling_rate": 1 }
}
```

## Env Interface

```typescript
interface Env {
  REPORTS_BUCKET: R2Bucket;
  TELEGRAM_SERVICE: Fetcher;
  CF_API_TOKEN_BINDING: string; // Cloudflare API token with Browser Rendering + R2 write
}
```

## 📂 Files

| File | Purpose |
|------|---------|
| `src/index.ts` | Cron handler, HTML→PDF conversion, R2 storage |
| `wrangler.jsonc.example` | Configuration template |

## Related

- [System Overview](../architecture/overview.md)
- [Bindings Reference](../architecture/bindings.md)
