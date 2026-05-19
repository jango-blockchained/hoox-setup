---
title: "Deploying to Production"
description: "How to compile and deploy the entire Hoox edge microservice stack, configure V8 service binding dependencies, and deploy the Next.js dashboard."
---

# 🚀 Deploying to Production

Deploying your algorithmic trading ecosystem to Cloudflare’s production edge requires careful orchestration. Because workers communicate internally using fast-path **Service Bindings**, they have strict compile-time and deploy-time dependencies.

This guide outlines our automated deployment sequence, Next.js OpenNext compilation steps, post-deployment URL bindings, and troubleshooting runbooks.

---

## ⛓️ The Strict Deployment Dependency Chain

When you deploy, workers must be uploaded in a specific sequence. If you attempt to deploy the public gateway (`hoox`) before the database or execution engines are live, the deployment will fail because the gateway's compile-time service bindings cannot resolve their targets.

The Hoox CLI automates this dependency hierarchy:

```
[1. D1 Database Schema] ──► [2. d1-worker (SQL Hub)] ──► [3. trade-worker (Execution Engine)]
                                                                    │
    ┌───────────────────────────────────────────────────────────────┘
    ▼
[4. hoox Gateway (Public Router)] ──► [5. agent-worker & telegram-worker]
                                                    │
                                                    ▼
                                    [6. Next.js Dashboard (OpenNext)]
```

---

## ⚡ Deployment CLI Commands

To execute a complete production rollout:

```bash
# 1. Compile and deploy all enabled workers in the correct dependency order
hoox deploy all --auto

# 2. Deploy a single specific worker (e.g. after a custom logic update)
hoox deploy worker trade-worker
```

### Critical Post-Deployment Automation

Once `hoox deploy all` finishes uploading the workers, you must run three final scripts to link webhooks and sync environment databases:

```bash
# A. Register your private Telegram Bot webhook with Cloudflare
hoox deploy telegram-webhook

# B. Auto-update and bind internal Service URLs across all workers
hoox deploy update-internal-urls

# C. Sync and apply the default CONFIG_KV manifest variables
hoox deploy kv-config
```

---

## 🖥️ Next.js Dashboard Deployment (OpenNext)

The Hoox Command Center is a modern Next.js 16 web application that runs directly on Cloudflare Workers using the **OpenNext adapter**.

When you run `hoox deploy dashboard`:

1. The CLI compiles the Next.js app using the Turbopack build engine.
2. The **OpenNext** compiler bundles the application logic into a single Edge-compliant V8 worker file: `.open-next/worker.js`.
3. All static files (images, JS chunks, CSS) are isolated under `.open-next/assets/`.
4. The CLI uses `wrangler` to deploy the worker and binds the static assets to Cloudflare's **ASSETS binding**, serving pages at sub-millisecond speeds.

```bash
# Build and deploy the Next.js Dashboard to Cloudflare Workers
hoox deploy dashboard
```

---

## 🔄 Routine Update & Upgrade Workflow

To pull the latest platform releases, run local tests, and update your active production edge:

```bash
# 1. Fetch latest changes and update git submodules recursively
git pull --recurse-submodules

# 2. Install updated dependencies
bun install

# 3. Execute the full local CI verification pipeline
hoox test

# 4. Roll out updates globally to the Cloudflare Edge
hoox deploy all --auto
```

---

## 🛠️ Post-Deployment Troubleshooting Matrix

| Error Code / Symptom          | Primary Root Cause                                | Guided Resolution                                                                                                                 |
| :---------------------------- | :------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------- |
| **`502 Bad Gateway`**         | Service binding target is missing or has crashed. | Ensure the dependency worker (e.g., `trade-worker`) has been deployed successfully. Run `hoox deploy all` to rebuild all bonds.   |
| **`503 Service Unavailable`** | The Global Kill Switch is active in KV.           | Verify switch state: `hoox monitor kill-switch show`. If safe, restore trading: `hoox monitor kill-switch off`.                   |
| **`401 Unauthorized`**        | Webhook request failed passkey check.             | Audit KV authorization key: `hoox config kv get webhooks:api_key`. Verify the payload `apiKey` matches this value.                |
| **`409 Conflict`**            | Durable Object intercepted a duplicate trace ID.  | Verify TV alert settings. Do not configure rapid-fire duplicate alerts within the same minute unless idempotency keys are unique. |

---

> **Tip:** By utilizing **Smart Placement** in your production builds, Cloudflare will automatically route execution to the edge nodes located geographically closest to your exchanges (Frankfurt, Tokyo), ensuring high-speed fills!

### 🔗 Next Steps

- **[Real-Time Observability & Monitoring](monitor-trading.md)** — Audit live fills, tail console logs, and run health diagnostics.
- **[System Self-Healing & Repair](repair.md)** — Rebuild broken bindings and recover from deployment anomalies.
