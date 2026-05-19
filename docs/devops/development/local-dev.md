---
title: "Local Development Setup"
description: "Detailed operational guide for local development setups, covering Wrangler CLI native dev parameters, Docker Compose profiles, and local .dev.vars mocking."
---

# 💻 Local Development Setup

Hoox provides a comprehensive local development workspace designed to emulate your production Cloudflare edge environment. Developers can choose between running microservices natively on local Wrangler V8 isolates or inside completely isolated, containerized Docker stacks, with real-time log tailing and TUI diagnostics.

---

## ⚡ 1. Dev Runtime Selection: Native vs. Docker

The `hoox dev start` command orchestrates the boot sequence for all enabled workers and supports two execution runtimes:

| Runtime Mode | Boot Command        | Latency / Hot-Reload |         Isolation Level          | Ideal Use Case                                                   |
| :----------- | :------------------ | :------------------: | :------------------------------: | :--------------------------------------------------------------- |
| **Native**   | `wrangler dev`      |      **< 10ms**      |  Low (shares local host ports)   | High-speed script tweaking, rapid feature iterations.            |
| **Docker**   | `docker compose up` |      **~100ms**      | High (isolated Linux containers) | Testing full integrations, database migrations, queue failovers. |

### The Guided Startup Flow

When you run `hoox dev start`:

1. **Wrangler Version Verification**: Probes your global/local Wrangler package. If Wrangler is outdated, it prompts an advisory upgrade warning:
   ```
   ⚠️  Wrangler CLI is outdated (v3.50.0 < v3.88.0)
       Run `bunx wrangler update` to update, or press Enter to continue.
   ```
2. **Docker Environment Probing**: Checks if the Docker daemon is active and `docker-compose.yml` is present in the workspace.
3. **Runtime Preference Lock**: If both runtimes are available, the CLI prompts you to select your preference. This choice is written to your `wrangler.jsonc` file under the `"dev": { "runtime": "..." }` block, bypassing future prompts.

```bash
# Override the saved runtime preference on the fly
hoox dev start --runtime native
hoox dev start --runtime docker
```

---

## 🐳 2. Docker Compose Orchestration & Profiles

For full stack containerized development, Hoox divides operations into three Docker Compose profiles in your root `docker-compose.yml`:

```bash
# Profile 1: Spin up all background workers only
docker compose --profile workers up

# Profile 2: Spin up the Next.js frontend only
docker compose --profile dashboard up

# Profile 3: Full Stack (All workers + Next.js dashboard)
docker compose --profile full up
```

---

## 📍 3. Local Port Mapping Registry

In the local environment, each V8 dev instance mounts to a dedicated host port. Ensure no other applications are occupying these ports before launching:

| Microservice          | Default Port | Local Binding URL       | Purpose                   |
| :-------------------- | :----------: | :---------------------- | :------------------------ |
| **`hoox`**            |    `8787`    | `http://localhost:8787` | Ingress Gateway           |
| **`trade-worker`**    |    `8789`    | `http://localhost:8789` | Order Execution Engine    |
| **`telegram-worker`** |    `8791`    | `http://localhost:8791` | Notifications Hub         |
| **`d1-worker`**       |    `8792`    | `http://localhost:8792` | Relational SQLite Manager |
| **`web3-wallet`**     |    `8793`    | `http://localhost:8793` | On-Chain DeFi Node        |
| **`dashboard`**       |    `8794`    | `http://localhost:8794` | Next.js Dashboard SSR     |
| **`agent-worker`**    |    `8795`    | `http://localhost:8795` | Cron Risk Monitor         |

---

## 🛡️ 4. Local Environmental Mocking (`.dev.vars`)

Because production secrets are locked inside Cloudflare's secured key vaults, Wrangler dev uses local `.dev.vars` files located inside each worker's directory to mock API keys and credentials:

```bash
# 1. Copy the secure template
cp workers/hoox/.dev.vars.example workers/hoox/.dev.vars

# 2. Inject local mock keys for testing
echo 'INTERNAL_KEY_BINDING="local_test_key"' >> workers/hoox/.dev.vars
```

> **Warning:** `.dev.vars` files contain local plaintext keys and are excluded from git index tracking via `.gitignore`. **Never** remove these files from `.gitignore` or check them into your repository.

---

> **Tip:** If local tests fail with `Time-Stamp Expired` errors when calling exchange APIs, check that your local machine's NTP system clock is synchronized: `sudo ntpdate pool.ntp.org` (or check date/time settings on macOS/Windows)!

### 🔗 Next Steps

- **[Testing Standards](testing.md)** — Run unit and integration tests using Bun's native test runner.
- **[Debugging Runbook](debugging.md)** — Debug local and remote isolates, tail logs, and trace queries.
