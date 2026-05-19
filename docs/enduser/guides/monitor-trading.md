---
title: "Monitoring Operations"
description: "How to run real-time health checks, monitor log telemetry, inspect queue depths, and govern the Global Kill Switch using the hoox CLI."
---

# 📈 Monitoring Operations

Algorithmic trading demands high-integrity, real-time observability. Because Hoox microservices are distributed across Cloudflare's global edge network, tracking health, logs, and message queues requires a consolidated management plane.

This guide outlines how to use the Hoox CLI to audit system status, monitor queue backlogs, stream live edge logs, and manage the emergency kill switch.

---

## 🟢 1. Probing Worker Health Status

Every Hoox worker is configured with a secure `/health` endpoint that validates local CPU capacity, binding access, and D1 database connection integrity.

To probe and audit all active endpoints simultaneously:

```bash
hoox monitor status
```

### Expected Output

The CLI runs asynchronous concurrent health probes, displaying green indicators and public route locations:

```
┌────────────────────────────────────────────────────────┐
│               Hoox Microservice Health Probes          │
├────────────────────────────────────────────────────────┤
│  hoox (Gateway) ... ✅ OK  https://hoox.alpha.workers.dev/health
│  trade-worker ..... ✅ OK  (Internal Binding Verified)  │
│  d1-worker ........ ✅ OK  (Internal Binding Verified)  │
│  telegram-worker .. ✅ OK  (Internal Binding Verified)  │
│  agent-worker ..... ✅ OK  (Internal Binding Verified)  │
│                                                        │
│  System Status: HEALTHY (0 warnings, 0 errors)         │
└────────────────────────────────────────────────────────┘
```

---

## 🚨 2. Governing the Global Kill Switch

The **Global Kill Switch** is your emergency brake. Stored inside the sub-millisecond `CONFIG_KV` namespace, flipping this parameter instantly blocks all incoming trade signals globally in under 10 seconds, without requiring code updates or worker redeployments.

```bash
# A. View the active state of the Kill Switch
hoox monitor kill-switch show

# B. Emergency HALT - disable all edge trade execution immediately
hoox monitor kill-switch on

# C. Resume normal operations
hoox monitor kill-switch off
```

> **Warning:** When the Kill Switch is turned `ON`, the `hoox` gateway router immediately rejects all incoming TradingView alerts and API webhook requests with a `503 Service Unavailable` error and logs a `KILL_SWITCH_ACTIVE` warning. Active positions must be flattened manually or via `hoox monitor trades close-all`.

---

## 🗃️ 3. Auditing Recent Transactions

To review execution history directly from your terminal:

```bash
# Print the 10 most recent trades executed across all exchanges
hoox monitor trades

# Print the 50 most recent trades
hoox monitor trades 50
```

This aggregates entries from your production D1 database and prints a formatted terminal table outlining:
`TIMESTAMP | REQUEST_ID | EXCHANGE | SYMBOL | ACTION | QUANTITY | PRICE | STATUS`

---

## 📨 4. Inspecting Queue Depth (Guaranteed Delivery Backlog)

If network volatility causes exchange API dropouts, Hoox offloads trade execution payloads to Cloudflare Queues. To check if there is an active execution backlog:

```bash
hoox monitor queue-depth
```

This displays the number of pending messages in the queue:

- **`0`**: System is running normally (all trades executing on the fast-path direct service binding).
- **`> 0`**: Exchange API is experiencing rate-limits or downtime. Trade-worker is retrying transactions asynchronously in the background.

---

## 📝 5. Real-Time Log Streaming & Telemetry

When debugging custom strategies, you can stream verbose console logs directly from Cloudflare's global edge nodes to your local terminal using Wrangler bindings:

```bash
# A. Stream live console logs for a specific worker
hoox logs tail trade-worker

# B. Stream gateway traffic in real-time
hoox logs tail hoox
```

### Downloading Logs for Off-Line Analysis

To download historical logs offloaded to your R2 storage bucket for compliance audits or tax reports:

```bash
hoox logs download hoox --output logs/gateway-backup.log
```

---

> **Tip:** If the system status check returns a red error indicator (e.g. `d1-worker ... ❌ FAILED`), immediately proceed to the **[Self-Healing & Repair Guide](repair.md)** to run automated diagnostics and restore service bindings!

### 🔗 Next Steps

- **[Self-Healing & Repair](repair.md)** — Diagnose connection drops, recreate broken bindings, and rebuild environments.
- **[Terminal UI Operations](tui.md)** — Monitor health status, tail logs, and edit configurations interactively in a full-screen GUI cockpit.
