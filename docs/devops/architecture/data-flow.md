---
title: "🌊 Data Flow"
description: "Deep dive into the data flow across 9 Hoox workers"
---
# 🌊 Data Flow

> Deep dive into the data flow across 9 Hoox workers

## 1. Webhook to Trading Flow

Primary flow: TradingView webhook → trade execution → notification → analytics.

```mermaid
sequenceDiagram
    participant TV as TradingView
    participant Hoox as hoox (Gateway)
    participant Trade as trade-worker
    participant D1 as d1-worker
    participant TG as telegram-worker
    participant AE as analytics-worker

    TV->>Hoox: POST /webhook (Trading Signal)
    Hoox->>Hoox: Validate API Key
    Hoox->>Hoox: KV rate limiter check
    Hoox->>Hoox: DO idempotency check
    Hoox->>Trade: TRADE_SERVICE.fetch()
    Trade->>Trade: Parse Signal & Execute on Exchange
    Trade->>D1: D1_SERVICE.fetch() (Log Trade)
    Trade-->>Hoox: Return Trade Result
    Hoox->>TG: TELEGRAM_SERVICE.fetch() (Notification)
    TG-->>Hoox: Return Notification Result
    Hoox->>AE: ANALYTICS_SERVICE (Track API Call)
    Hoox-->>TV: 200 OK (Summary)
```

## 2. AI Risk Management Flow

Agent-worker runs every 5 minutes to monitor positions and manage risk.

```mermaid
sequenceDiagram
    participant Agent as agent-worker
    participant Trade as trade-worker
    participant D1 as d1-worker
    participant TG as telegram-worker
    participant AI as Workers AI

    Agent->>Agent: Cron: */5 * * * *
    Agent->>D1: Query open positions
    D1-->>Agent: Position data
    Agent->>AI: Analyze risk (LLaMA 3)
    AI-->>Agent: Risk assessment
    Agent->>Trade: Adjust stops / scale out
    Agent->>TG: Send health summary
```

## 3. PDF Report Flow

Report-worker generates PDFs twice daily via Browser Rendering.

```mermaid
sequenceDiagram
    participant Report as report-worker
    participant BR as Browser Rendering API
    participant R2 as R2 Bucket
    participant TG as telegram-worker

    Report->>Report: Cron: 06:00 + 18:00 UTC
    Report->>Report: Build HTML report
    Report->>BR: POST /browser-rendering/pdf
    BR-->>Report: PDF Buffer
    Report->>R2: Store PDF (reports/daily-*.pdf)
    Report->>TG: Send report link
```

## 4. Analytics Flow

Every API call across all workers is tracked for observability.

```mermaid
sequenceDiagram
    participant W as Any Worker
    participant AE as analytics-worker
    participant EE as Analytics Engine

    W->>AE: POST /track/api-call {worker, endpoint, latencyMs, success}
    AE->>AE: Validate payload
    AE->>EE: writeDataPoint({blobs, doubles, indexes})
```

## 5. Data Persistence

| Storage | Data | Workers |
|---------|------|---------|
| D1 Database | Trade logs, positions, signals | d1-worker, trade-worker, agent-worker |
| KV (CONFIG_KV) | Routing rules, IP lists, rate limiter state | All workers |
| KV (SESSIONS_KV) | Webhook sessions | hoox |
| R2 (trade-reports) | Trade reports, PDFs | trade-worker, report-worker |
| R2 (user-uploads) | User file uploads | telegram-worker |
| R2 (hoox-system-logs) | Verbose exchange logs | trade-worker |
| Vectorize | AI embeddings for RAG | telegram-worker, hoox |
| Analytics Engine | Time-series API metrics | analytics-worker |

## Next Steps

- [System Overview](overview.md)
- [Worker Communication](communication.md)
