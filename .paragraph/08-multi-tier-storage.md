# Four Speeds of Memory: HOOX Multi-Tier Storage

_Sources: `docs/devops/architecture/storage.mdx`, `DESIGN.md` data models, paper data-layer sections, README primitives._

---

## Thesis

HOOX does not pretend one database can be a mutex, a config plane, a ledger, and a PDF archive. It assigns each job to the Cloudflare primitive whose **consistency, latency, and cost** match the job. That assignment _is_ the data architecture.

---

## 1. Tier map

| Primitive            | Consistency              | Feel                            | Ideal use                                                  |
| -------------------- | ------------------------ | ------------------------------- | ---------------------------------------------------------- |
| **Durable Objects**  | Strong (single-threaded) | &lt;2 / &lt;5 ms class          | Idempotency locks, WS session managers                     |
| **Workers KV**       | Eventual                 | Sub-ms reads; slow global write | Kill switch, queue mode, routing, rate windows, watermarks |
| **D1 (SQLite)**      | Relational edge SQL      | ~5–12 ms class                  | Trades, positions, balances, system_logs                   |
| **R2**               | Strong per object        | Tens of ms                      | Verbose exchange JSON, PDFs, heavy logs                    |
| **Vectorize**        | ANN index                | Query-bound                     | RAG over trade history                                     |
| **Analytics Engine** | Append time-series       | Non-blocking write              | Latency & API metrics                                      |

Adjacent: **Queues**, **Browser Rendering**, **Secrets** (never KV/D1 for API keys).

---

## 2. D1 through one door

All business SQL → **`d1-worker`**. Centralization enables:

- Query guards (dangerous statements, injection shapes, table allowlists)
- Schema evolution in one place
- Binding auth in front of the ledger

Core tables: `trade_signals`, `trades`, `positions`, `balances`, `system_logs`—with trace/request ids for reconstruction.

---

## 3. KV as control plane

CONFIG_KV is where operators and agents meet: kill switch, queue mode, routing overrides, rate windows, trailing watermarks. Reads are cheap; writes are eventually consistent. Policy belongs here; **double-spend locks do not**.

---

## 4. R2 as cold / bulky path

Exchange dumps and PDF reports would punish D1 quotas. R2 takes bulk; Telegram gets links; the ledger stays lean. Enterprise thickens this into jurisdiction-aware **immutable audit** ([essay 13](./13-enterprise-upcoming.md)).

---

## 5. Analytics Engine as free black box

`trackAnalytics` after response via `waitUntil`. Metrics must not lengthen the 22 ms path. Dashboard SQL against `hoox-analytics` reconstructs latency without a third-party APM bill at retail scale.

---

## 6. Decision procedure

For every new field:

1. Must concurrent requests serialize? → **DO**
2. Runtime operator flag? → **KV**
3. Money / relational agent state? → **D1** via d1-worker
4. Huge or archival? → **R2**

If the answer is “all of the above,” you are designing a workflow, not a column.

**Previous:** [agent-worker](./07-autonomous-risk-manager.md) · **Next:** [Five-layer security](./09-five-layer-security.md)
