# 🌊 Data Flow

> Deep dive into the data flow across Hoox workers

## 1. Webhook to Trading Flow

The primary data flow starts with an external webhook (e.g., from TradingView) and results in a trade execution and notification.

```mermaid
sequenceDiagram
    participant TV as TradingView
    participant Hoox as hoox (Gateway)
    participant Trade as trade-worker
    participant D1 as d1-worker
    participant TG as telegram-worker

    TV->>Hoox: POST / (Trading Signal)
    Hoox->>Hoox: Validate API Key & IP
    Hoox->>Trade: TRADE_SERVICE.fetch()
    Trade->>Trade: Parse Signal & Calculate Size
    Trade->>Trade: Execute on Exchange (MEXC, etc.)
    Trade->>D1: D1_SERVICE.fetch() (Log Trade)
    Trade-->>Hoox: Return Trade Result
    Hoox->>TG: TELEGRAM_SERVICE.fetch() (Send notification)
    TG-->>Hoox: Return Notification Result
    Hoox-->>TV: 200 OK (Summary Response)
```

## 2. Notification & AI Flow

When a user interacts with the Telegram bot or an internal system sends an alert.

```mermaid
sequenceDiagram
    participant User as Telegram User
    participant TG as telegram-worker
    participant AI as Workers AI
    participant Vec as Vectorize (RAG)

    User->>TG: Send Message
    TG->>TG: Parse Command
    TG->>Vec: Query Embeddings (if needed)
    Vec-->>TG: Return Context
    TG->>AI: Generate Response (with context)
    AI-->>TG: Return Generated Text
    TG-->>User: Send Telegram Message
```

## 3. Data Persistence Flow

Hoox uses multiple storage mechanisms:

- **D1 Database**: Relational data (Trade logs, System logs, Positions)
- **KV Store**: Key-Value data (Configurations, Allow-lists, Session data)
- **R2 Storage**: Object storage (Trade reports, User uploads)
- **Vectorize**: Vector embeddings for RAG and AI search.

## Next Steps

- [System Overview](overview.md)
- [Worker Communication](communication.md)
