# Hoox Storage Architecture

The Hoox Trading System leverages three primary Cloudflare storage primitives to ensure high performance, security, and low operational latency at the edge.

## 1. D1 (SQLite at the Edge)

**Purpose:** High-value, structured relational data.
**Primary Uses:**

- Trade signals (`trade_signals`)
- Executed trades and historical performance (`trades`)
- Active position tracking (`positions`)
- Balances and system state (`balances`)

**Principles:**

- **Durability and Consistency:** D1 is used when ACID guarantees are necessary, ensuring that trades and position states are never lost or corrupted.
- **Queryability:** Enables the complex aggregation queries required by the Next.js dashboard for charts and metrics.
- **Resource Constraints:** D1 has strict limits on the free tier (100k writes/day, 5M reads/day). Therefore, verbose or ephemeral data should _not_ be stored here.

## 2. R2 (Object Storage)

**Purpose:** High-volume, unstructured, or verbose data offloading.
**Primary Uses:**

- Verbose system logs (`hoox-system-logs`)
- Trade execution reports and JSON snapshots (`trade-reports`)
- User-uploaded assets for notifications/UI (`user-uploads`)

**Principles:**

- **Cost-Efficiency:** R2 is significantly cheaper and more scalable for storing large volumes of data compared to D1.
- **Observability:** Detailed request and response logs (including headers and payloads) are written here. This allows for deep debugging via trace IDs without bloating the D1 database.
- **Eventual Consistency:** R2 is ideal for data that is written once and read occasionally (like a historical log), rather than data that is frequently mutated.

## 3. Workers KV (Key-Value Store)

**Purpose:** Global configuration, session management, and low-latency dynamic routing.
**Primary Uses:**

- System Configuration (`CONFIG_KV`)
  - Kill switches
  - IP Allowlists
  - Dynamic Exchange Routing maps
- Session Management (`SESSIONS_KV`)

**Principles:**

- **Extreme Low Latency:** KV is read-optimized and aggressively cached at the edge. It is the fastest way to look up simple configuration flags during the critical path of trade execution.
- **Dynamic Extensibility:** Allows system behavior (like pausing trading or re-routing a specific asset) to be changed instantly without needing to redeploy worker code.
- **Eventual Consistency (Writes):** While reads are instant, writes can take up to 60 seconds to propagate globally. Therefore, KV is not suitable for rapidly changing state (like position sizes), but perfect for configuration.

## 4. Storage Security

- All sensitive configuration keys (like API keys) are stored in the Cloudflare Secret Store, _not_ in KV or D1.
- R2 buckets are private by default. Access is managed strictly through secure Service Bindings within the Workers.
- D1 databases are only accessible via the `D1_SERVICE` binding, meaning external users can never query the database directly.
