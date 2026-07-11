// Source: workers/trade-worker/schema.sql (lines 25-44)
// Listing id: schema-trades
// Caption: D1 trades table DDL (idempotent schema)
-- 2. Executed Trades
CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY,             -- Unique identifier for the trade
    signal_id TEXT,                  -- Optional link to the originating signal
    timestamp INTEGER NOT NULL,      -- Unix timestamp
    exchange TEXT NOT NULL,          -- Exchange name (e.g., 'mexc', 'binance')
    symbol TEXT NOT NULL,            -- Trading symbol
    action TEXT NOT NULL,            -- Action (e.g., 'LONG', 'SHORT', 'CLOSE_LONG')
    quantity REAL,                   -- Size of the trade
    price REAL,                      -- Execution price
    leverage INTEGER,                -- Leverage used
    status TEXT NOT NULL,            -- Status ('EXECUTED', 'FAILED', 'PENDING')
    error_message TEXT,              -- Any error message if failed
    raw_response TEXT,               -- JSON response from the exchange
    created_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades (timestamp);
CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades (symbol);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades (status);
