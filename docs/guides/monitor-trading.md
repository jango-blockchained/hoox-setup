---
title: "Monitor Trading"
description: "Health checks, kill switch, logs, and metrics"
---

# Monitor Trading

## Worker Health

```bash
# Check all worker health endpoints
hoox monitor status
```

Expected output shows each worker's status:

```
hoox .............  ✅  https://hoox.mytrading.workers.dev/health
trade-worker ....  ✅  https://trade-worker.mytrading.workers.dev/health
d1-worker .......  ✅  https://d1-worker.mytrading.workers.dev/health
...
```

## Kill Switch

Emergency stop that halts all trading instantly. No redeployment needed.

```bash
# Check status
hoox monitor kill-switch show

# Halt all trading
hoox monitor kill-switch on

# Resume trading
hoox monitor kill-switch off
```

## Recent Trades

```bash
# Show last 10 trades
hoox monitor trades

# Show last 50 trades
hoox monitor trades 50
```

## System Logs

```bash
# Recent logs across all workers
hoox monitor logs

# Logs for a specific worker
hoox monitor logs hoox
```

## Queue Depth

```bash
hoox monitor queue-depth
```

Shows how many pending messages are in the trade execution queue.

## Backup

```bash
# Export D1 database to timestamped .sql file
hoox monitor backup
```

## Per-Worker Log Streaming

```bash
# Stream logs in real-time
hoox logs tail trade-worker

# Download recent logs
hoox logs download hoox
```

## Next Steps

- [Repair Guide](repair.md) — What to do when something goes wrong
