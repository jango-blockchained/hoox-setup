---
title: "d1-worker Isolate Profile"
description: "Comprehensive engineering specification for the Hoox D1 SQLite Database Proxy Worker, covering SQL query interfaces, batch operations, and dashboard statistics aggregation."
---

# 🗄️ d1-worker Isolate Profile

The **`d1-worker`** is the data routing hub of the Hoox trading platform. Deployed as an isolated, private micro-worker, it acts as a centralized SQL execution proxy. By encapsulating database interactions behind secure Service Bindings, it allows other lightweight compute workers to execute parameterized queries, trigger transactional batch operations, and retrieve structured dashboard telemetry without direct database driver overhead.

---

## ⚡ 1. Declared Wrangler Configurations & Bindings

The `d1-worker` binds directly to the production SQLite database (`trade-data-db`) and does not expose any public endpoints:

```jsonc
{
  "name": "d1-worker",
  "main": "src/index.ts",
  "compatibility_date": "2026-05-19",
  "compatibility_flags": ["nodejs_compat"],
  "account_id": "debc6545e63bea36be059cbc82d80ec8",
  "placement": {
    "mode": "smart",
  },
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "trade-data-db",
      "database_id": "c5917667a21745e390ff969f32b1847a",
    },
  ],
  "kv_namespaces": [
    {
      "binding": "CONFIG_KV",
      "id": "c5917667a21745e390ff969f32b1847d",
    },
  ],
  "secrets": ["INTERNAL_KEY_BINDING"],
}
```

---

## 🔌 2. Internal REST API Specification

Every endpoint is secured via `requireInternalAuth` and expects the `X-Internal-Auth-Key` header.

### A. Execute Single SQL Query

- **Endpoint**: `/query`
- **Method**: `POST`
- **JSON Payload**:
  ```json
  {
    "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "query": "SELECT created_at, symbol, action, price FROM trades WHERE symbol = ? ORDER BY created_at DESC LIMIT ?",
    "params": ["BTCUSDT", 5]
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "results": [
      {
        "created_at": 1779261050000,
        "symbol": "BTCUSDT",
        "action": "LONG",
        "price": 68425.5
      }
    ],
    "meta": { "rows_read": 1, "rows_written": 0, "duration": 4.2 }
  }
  ```

---

### B. Execute Transactional Batch Operations

Allows running multiple statements atomically in a single network trip, reducing latency.

- **Endpoint**: `/batch`
- **Method**: `POST`
- **JSON Payload**:
  ```json
  {
    "requestId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
    "queries": [
      {
        "query": "INSERT INTO trades (id, symbol, price) VALUES (?, ?, ?)",
        "params": ["trade-1", "BTCUSDT", 68000]
      },
      {
        "query": "UPDATE positions SET size = size + ? WHERE symbol = ?",
        "params": [0.005, "BTCUSDT"]
      }
    ]
  }
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "results": [{ "meta": { "changes": 1 } }, { "meta": { "changes": 1 } }]
  }
  ```

---

### C. Dashboard Telemetry Statistics

Calculates aggregated win ratios, active positions size, and time-series P&L.

- **Endpoint**: `/api/dashboard/stats`
- **Method**: `GET`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "stats": {
      "totalTrades": 1048,
      "winRate": 64.2,
      "totalPnlUSDT": 18340.5,
      "activePositionsCount": 2,
      "dailyTradesCount": 14
    }
  }
  ```

---

## 🛡️ 3. Security & SQL Injection Protection

To protect financial transaction ledgers and portfolios against SQL injection attacks, `d1-worker` enforces strict development rules:

- **Parameterized Bindings**: All inputs must utilize parameterized placeholders (`?` or `?1`) mapped to `env.DB.prepare().bind()`. **Never** concatenate raw request strings directly into SQL statements.
- **Access Isolation**: The database does not exist publicly. By binding D1 solely to this worker and accessing it via V8 Service Bindings, you prevent external crawlers or bots from querying database nodes directly.

---

> **Tip**: If you are extending schemas or adding tables, generate migration scripts locally using Drizzle: `hoox db migrate --remote`. This keeps edge schema histories atomic and securely tracked.

### 🔗 Next Steps

- **[System Storage Architecture](../architecture/storage.md)** — Review SQLite properties and R2 bucketing pipelines.
- **[Database Operations Manual](../guides/database-ops.md)** — Learn commands to run query ledgers and restore backups.
