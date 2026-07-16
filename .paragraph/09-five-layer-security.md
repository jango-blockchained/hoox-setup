# Five Walls Deep: HOOX Security as Concentric Rings

_Sources: `papers/sections/05-security.tex`, architecture overview 5-layer model, `docs/devops/security/overview.mdx`._

---

## Thesis

HOOX security is not a single middleware file. It is **five concentric corridors**. Traffic that reaches an exchange signature has already survived edge filtering, webhook auth, isolation, internal auth, and (on the success path) an idempotency lock. Each layer has a declared **failure mode**.

Enterprise does not replace this model; it **thickens** it ([essay 13](./13-enterprise-upcoming.md)).

---

## 1. The five layers

```text
[1 WAF / IP allow-list]
  → [2 Webhook API key]
    → [3 Service Binding isolation]
      → [4 X-Internal-Auth-Key]
        → [5 Durable Object mutex]
```

| Layer | Control                                                           | Failure mode                               |
| ----- | ----------------------------------------------------------------- | ------------------------------------------ |
| 1     | WAF + TradingView IP CIDRs (KV-extensible)                        | Drop / 403 at edge                         |
| 2     | `apiKey` + `timingSafeEqual`; 100 KB cap; rate limit; kill switch | 401 / 429 / 503                            |
| 3     | No public routes on internal workers                              | Unreachable                                |
| 4     | `requireInternalAuth` on binding routes                           | **401 fail-closed**                        |
| 5     | Idempotency DO                                                    | Reject duplicate; **fail-open if DO down** |

---

## 2. Asymmetry is intentional

> **Authentication fails closed. Deduplication fails open.**  
> A forged trade is not recoverable the way a possible double is.

That sentence is the open-core threat-model thesis.

---

## 3. Secondary ingress & data guards

**Email:** Mailgun HMAC (`timestamp + token`), constant-time compare, same Zod trade schema, then binding to `trade-worker`.

**D1:** parameterized patterns, `validateQuery`-style rejection of dangerous SQL, table allowlists, known CONFIG_KV prefixes for dashboard settings. Compromise of one binding ≠ `DROP TABLE`.

---

## 4. Secrets & crypto

- Secrets in **Wrangler secret bindings**, never KV/D1
- `CryptoKey` import once per isolate; HMAC-SHA256 per venue
- WS DO state: **handles only**, not signing material

Rate limit: **10 trades / 60 s** per session (KV sliding window + cold-start-safe patterns). Response hardening: CSP, frame options, nosniff, HSTS via shared middleware.

---

## 5. Operator checklist

1. Rotate webhook and internal keys as secrets.
2. Keep TradingView IP ranges current.
3. Treat kill switch as production control.
4. Run `tests/security/` in CI.
5. Never leave probe short-circuits on a path that can sign live orders without flags.

**Previous:** [Storage](./08-multi-tier-storage.md) · **Next:** [Observability](./10-observability-hot-path.md)
