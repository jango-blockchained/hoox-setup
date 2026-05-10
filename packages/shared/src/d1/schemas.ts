/**
 * TypeScript interfaces for D1 database tables
 * Based on the schema defined in workers/trade-worker/schema.sql
 */

export interface TradeRecord {
  id: string;
  /** Optional link to the originating signal */
  signal_id?: string | null;
  /** Unix timestamp (seconds) */
  timestamp: number;
  exchange: string;
  symbol: string;
  action: string;
  quantity: number | null;
  price: number | null;
  leverage: number | null;
  status: string;
  error_message?: string | null;
  /** JSON response from the exchange */
  raw_response?: string | null;
  created_at?: number;
}

export interface PositionRecord {
  id: string;
  exchange: string;
  symbol: string;
  side: "LONG" | "SHORT";
  entry_price?: number | null;
  mark_price?: number | null;
  liquidation_price?: number | null;
  leverage?: number | null;
  size: number | null;
  unrealized_pnl?: number | null;
  status: "OPEN" | "CLOSED";
  updated_at: number;
}

export interface BalanceRecord {
  id: string;
  exchange: string;
  asset: string;
  free: number | null;
  used: number | null;
  total: number | null;
  /** Unix timestamp */
  timestamp: number;
}

export interface SystemLogRecord {
  id: string;
  /** Unix timestamp (defaults to unixepoch()) */
  timestamp?: number;
  level: string;
  /** Worker name (e.g., 'hoox', 'trade-worker') */
  service: string;
  message: string;
  /** JSON string for extra context */
  details?: string | null;
}

export interface TradeSignalRecord {
  signal_id: string;
  /** Unix timestamp (seconds) */
  timestamp: number;
  symbol: string;
  signal_type: string;
  source?: string | null;
  /** Original raw signal data (e.g., JSON string) */
  raw_data?: string | null;
  /** Timestamp when the record was inserted (defaults to unixepoch()) */
  processed_at?: number;
}

/**
 * Generic D1 query result wrapper
 */
export interface D1QueryResult<T = unknown> {
  success: boolean;
  results?: T[];
  error?: string;
  meta?: {
    last_row_id?: number;
    changes?: number;
    duration?: number;
  };
}
