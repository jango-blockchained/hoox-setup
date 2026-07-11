// Source: workers/trade-worker/schema.sql (lines 79-90)
// Listing id: schema-system-logs
// Caption: D1 system_logs table DDL
CREATE TABLE IF NOT EXISTS system_logs (
    id TEXT PRIMARY KEY,
    timestamp INTEGER DEFAULT (unixepoch()),
    level TEXT NOT NULL,             -- 'INFO', 'WARN', 'ERROR', 'DEBUG'
    service TEXT NOT NULL,           -- Worker name (e.g., 'hoox', 'trade-worker')
    message TEXT NOT NULL,
    details TEXT                     -- JSON string for extra context
);

CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs (timestamp);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs (level);
CREATE INDEX IF NOT EXISTS idx_system_logs_service ON system_logs (service);
