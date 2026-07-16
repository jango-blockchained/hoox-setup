# The Watcher That Never Sleeps: agent-worker

_Sources: `docs/devops/workers/agent-worker.mdx`, signal lifecycle stage 7, data-flow AI risk sequences, paper limitations on cron risk._

---

## Thesis

Webhooks are reactive. Markets are continuous. HOOX’s answer to “who manages risk when no alert fires?” is **`agent-worker`**: a cron-driven isolate that wakes every **five minutes**, reads truth from D1 and the exchanges, and is empowered to **close positions and shut the front door**.

Execution (`trade-worker`) must stay fast and boring. Policy (`agent-worker`) must stay periodic, auditable, and allowed to slam the kill switch. Merging them makes every prompt tweak a deploy to order-signing.

---

## 1. Charter

| Concern | Behavior                                                    |
| ------- | ----------------------------------------------------------- |
| Trigger | Cron `*/5 * * * *`                                          |
| State   | Open positions via **`d1-worker`**                          |
| Market  | Public mark prices from CEX APIs                            |
| Actions | Service Bindings → **`trade-worker`**                       |
| Alerts  | **`telegram-worker`**                                       |
| Config  | Trailing stop %, take-profit %, drawdown, AI provider chain |

This is **stage 7** of the signal lifecycle—asynchronous, deterministic first, LLM second.

---

## 2. Normal loop

```text
Cron → agent → D1 OPEN positions → exchange marks
     → compare KV watermarks / drawdown
     → optional CLOSE / scale-out via trade-worker
     → telegram notify
```

**Trailing stops** store high-water marks in CONFIG_KV.  
**Take-profit scale-out** secures gains without a second TradingView alert.  
Portfolio hygiene as code—not as a human staring at Telegram at 03:00.

---

## 3. Kill switch — hard stop

When drawdown breaches configured limits, the agent writes **`trade:kill_switch = true`** (CONFIG_KV). Consequences:

1. **`hoox`** refuses new trades (**503** path on ingress pre-flight).
2. Flattening commands to **`trade-worker`**.
3. Emergency Telegram alert.

Gateway and agent share a **single source of truth** for “is the system allowed to open risk?” That shared key is more important than any model temperature.

---

## 4. Multi-provider AI

- Primary: **Workers AI**
- Fallbacks: OpenAI, Anthropic, Google AI, Azure OpenAI
- Health-checked failover, streaming, vision/reasoning where configured
- Periodic NL health digests over `system_logs`
- **Vectorize RAG** collaboration with telegram-worker (`/ask`, search)

Runtime config (`GET/POST /agent/config`) mutates provider chain without redeploying the mesh. **Invariant:** models summarize and advise; they do not replace signed risk gates on the placement path.

---

## 5. Academic honesty

The paper is careful: the cron risk manager is **intentionally simple**. Event-driven risk on **`ExchangeConnectionManager`** (fills, partials) is **planned**—and bulked up in [Enterprise](./13-enterprise-upcoming.md) (hibernatable WS + Workflows). Marketing a 5-minute loop as HFT risk would be academic malpractice.

**Previous:** [Latency race](./06-smart-placement-latency.md) · **Next:** [Multi-tier storage](./08-multi-tier-storage.md)
