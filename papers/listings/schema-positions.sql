// Source: workers/trade-worker/schema.sql (lines 47-63)
// Listing id: schema-positions
// Caption: D1 positions table DDL
CREATE TABLE IF NOT EXISTS positions (
    id TEXT PRIMARY KEY,             -- Unique ID, can be derived from exchange+symbol
    exchange TEXT NOT NULL,          
    symbol TEXT NOT NULL,
    side TEXT NOT NULL,              -- 'LONG' or 'SHORT'
    entry_price REAL,
    mark_price REAL,
    liquidation_price REAL,
    leverage INTEGER,
    size REAL,
    unrealized_pnl REAL,
    status TEXT NOT NULL,            -- 'OPEN' or 'CLOSED'
    updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_positions_status ON positions (status);
CREATE INDEX IF NOT EXISTS idx_positions_symbol ON positions (symbol);
