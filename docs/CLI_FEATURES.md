# Hoox CLI Features & Background Processes

The `hoox` CLI is the central management tool for the Hoox Trading System. This document outlines all user-facing commands and automated background tasks.

## User Commands

### Initialization & Setup
- `hoox init`: Runs the interactive setup wizard.
- `hoox check-setup`: Validates the environment, bindings, and configurations without modifying state.
- `hoox clone [destination]`: Clones the core `hoox-setup` repository.

### Worker Management
- `hoox workers clone`: Clones all or specific sub-worker repositories as submodules.
- `hoox workers setup`: Binds secrets and provisions the local environment for enabled workers.
- `hoox workers dev <workerName>`: Starts the local Wrangler development server for a specific worker.
- `hoox workers deploy [workerName]`: Deploys specific or all enabled workers to Cloudflare.
- `hoox workers status`: Launches the interactive TUI to monitor worker health and status.
- `hoox workers test`: Runs the Vitest integration suite across workers.

### Configurations & Secrets
- `hoox secrets update-cf <secret> <worker>`: Updates a Cloudflare Secret Store value and syncs it locally.
- `hoox secrets check <worker> [secret]`: Verifies secret bindings.
- `hoox keys generate/get/list`: Manages local `.keys/*.env` cryptographic keys.

### Utility & Logs
- `hoox logs download <workerName>`: Async download of worker logs from the R2 bucket, with automatic fallback to `wrangler tail`.
- `hoox housekeeping`: Runs a manual trigger of the system health checks.
- `hoox waf`: Configures Cloudflare WAF rules (IP allowlists, rate limiting).
- `hoox r2`: Provisions required R2 buckets.

## Background Functions & Processes

While the CLI manages deployments, the deployed system runs several critical background tasks automatically on Cloudflare's Edge:

1. **Housekeeping Cron (`agent-worker`)**
   - Runs every 5 minutes.
   - Monitors portfolio status, checks trailing stops, and validates the health of other workers.

2. **Idempotency Store (`hoox` gateway)**
   - A Durable Object that intercepts incoming webhooks.
   - Prevents duplicate trading signals from executing twice.

3. **Kill Switch Evaluation**
   - Read from `CONFIG_KV` on every request.
   - Immediately halts all trade execution if `kill_switch` is true, without requiring redeployment.

4. **Queue Processing (`trade-execution`)**
   - High-availability queue bridging the gateway and the `trade-worker`.
   - Includes automatic failovers and retry policies for exchange API timeouts.