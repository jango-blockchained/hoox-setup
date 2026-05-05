import type { CloudflareAdapter } from "../core/types.js";
import { createValidationResult, type ValidationResult } from "./validation.js";

const REQUIRED_TABLES = [
  "trade_signals",
  "trades",
  "positions",
  "balances",
  "system_logs",
];

const TRACKING_TABLES = ["signal_events", "event_trace", "worker_stats"];

const REQUIRED_INDEXES = [
  "idx_trade_signals_timestamp",
  "idx_trades_timestamp",
  "idx_positions_status",
  "idx_system_logs_timestamp",
];

export async function checkRequiredTables(
  adapter: CloudflareAdapter,
  databaseName: string
): Promise<ValidationResult> {
  const result = createValidationResult("Database Tables");

  try {
    const response = await adapter.executeD1Query(
      databaseName,
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const tableNames =
      response.results?.map((r: Record<string, unknown>) => r.name as string) ||
      [];

    for (const table of REQUIRED_TABLES) {
      if (!tableNames.includes(table)) {
        result.addError(
          `Missing required table: ${table}. Apply schema with: wrangler d1 execute ${databaseName} --file=workers/trade-worker/schema.sql --remote`
        );
      }
    }
  } catch (err) {
    result.addError(`Failed to query database tables: ${err}`);
  }

  return result;
}

export async function checkRequiredIndexes(
  adapter: CloudflareAdapter,
  databaseName: string
): Promise<ValidationResult> {
  const result = createValidationResult("Database Indexes");

  try {
    const response = await adapter.executeD1Query(
      databaseName,
      "SELECT name FROM sqlite_master WHERE type='index'"
    );
    const indexNames =
      response.results?.map((r: Record<string, unknown>) => r.name as string) ||
      [];

    for (const idx of REQUIRED_INDEXES) {
      if (!indexNames.includes(idx)) {
        result.addWarning(`Missing recommended index: ${idx}`);
      }
    }
  } catch (err) {
    result.addWarning(`Failed to check indexes: ${err}`);
  }

  return result;
}

export async function checkTrackingSchema(
  adapter: CloudflareAdapter,
  databaseName: string
): Promise<ValidationResult> {
  const result = createValidationResult("Tracking Schema");

  try {
    const response = await adapter.executeD1Query(
      databaseName,
      "SELECT name FROM sqlite_master WHERE type='table'"
    );
    const tableNames =
      response.results?.map((r: Record<string, unknown>) => r.name as string) ||
      [];

    for (const table of TRACKING_TABLES) {
      if (!tableNames.includes(table)) {
        result.addError(
          `Missing tracking table: ${table}. Run: bun run migrate:tracking`
        );
      }
    }
  } catch (err) {
    result.addError(`Failed to check tracking schema: ${err}`);
  }

  return result;
}
