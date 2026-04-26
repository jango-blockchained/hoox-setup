#!/bin/bash
# Migration script for D1 tracking schema
# Run with: npm run migrate:tracking
#
# Note: Uses d1-worker API to execute migrations

set -e

D1_WORKER_URL="https://d1-worker.cryptolinx.workers.dev"

echo "Running D1 tracking schema migration..."
echo "Using d1-worker API: $D1_WORKER_URL"
echo ""

SQL_FILE="workers/d1-worker/schema/tracking.sql"

if [ ! -f "$SQL_FILE" ]; then
    echo "ERROR: SQL file not found: $SQL_FILE"
    exit 1
fi

# Execute tables via d1-worker API (more reliable than wrangler CLI)
echo "Creating signal_events table..."
curl -s -X POST "$D1_WORKER_URL/query" \
  -H "Content-Type: application/json" \
  --data '{"query":"CREATE TABLE IF NOT EXISTS signal_events (id INTEGER PRIMARY KEY AUTOINCREMENT, event_id TEXT NOT NULL UNIQUE, worker_name TEXT NOT NULL, event_type TEXT NOT NULL, signal_id TEXT, trace_id TEXT, payload JSON, status TEXT DEFAULT '\''pending'\'', error_message TEXT, execution_time_ms INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER)"}'

echo "Creating event_trace table..."
curl -s -X POST "$D1_WORKER_URL/query" \
  -H "Content-Type: application/json" \
  --data '{"query":"CREATE TABLE IF NOT EXISTS event_trace (id INTEGER PRIMARY KEY AUTOINCREMENT, trace_id TEXT NOT NULL, worker_name TEXT NOT NULL, event_type TEXT NOT NULL, event_id TEXT, details JSON, created_at INTEGER NOT NULL)"}'

echo "Creating worker_stats table..."
curl -s -X POST "$D1_WORKER_URL/query" \
  -H "Content-Type: application/json" \
  --data '{"query":"CREATE TABLE IF NOT EXISTS worker_stats (id INTEGER PRIMARY KEY AUTOINCREMENT, worker_name TEXT NOT NULL UNIQUE, total_events INTEGER DEFAULT 0, total_errors INTEGER DEFAULT 0, avg_execution_time_ms REAL, last_event_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER)"}'

echo "Creating indexes..."
curl -s -X POST "$D1_WORKER_URL/query" \
  -H "Content-Type: application/json" \
  --data '{"query":"CREATE INDEX IF NOT EXISTS idx_signal_worker ON signal_events(worker_name)"}' > /dev/null
curl -s -X POST "$D1_WORKER_URL/query" \
  -H "Content-Type: application/json" \
  --data '{"query":"CREATE INDEX IF NOT EXISTS idx_signal_created ON signal_events(created_at)"}' > /dev/null
curl -s -X POST "$D1_WORKER_URL/query" \
  -H "Content-Type: application/json" \
  --data '{"query":"CREATE INDEX IF NOT EXISTS idx_signal_trace_id ON signal_events(trace_id)"}' > /dev/null
curl -s -X POST "$D1_WORKER_URL/query" \
  -H "Content-Type: application/json" \
  --data '{"query":"CREATE INDEX IF NOT EXISTS idx_trace_trace_id ON event_trace(trace_id)"}' > /dev/null

echo ""
echo "Migration completed successfully!"
echo "Tables created:"
echo "  - signal_events"
echo "  - event_trace"
echo "  - worker_stats"