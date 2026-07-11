// Source: workers/d1-worker/src/stats.ts (lines 19-37)
// Listing id: d1-stats-batch
// Caption: Internal five-query dashboard aggregate via DB.batch()
    // All 5 queries are independent aggregates -- batch them for single round-trip
    const stmts = [
      db.prepare("SELECT COUNT(*) as count FROM trades"),
      db.prepare(
        "SELECT COUNT(*) as count FROM positions WHERE status = 'OPEN'"
      ),
      db.prepare(
        "SELECT COUNT(*) as count FROM positions WHERE status = 'CLOSED'"
      ),
      db.prepare(
        "SELECT COUNT(*) as count FROM positions WHERE status = 'CLOSED' AND unrealized_pnl > 0"
      ),
      db
        .prepare("SELECT COUNT(*) as count FROM trades WHERE timestamp >= ?")
        .bind(todayStart),
    ];

    const [totalRow, activePosRow, totalClosedRow, profitableRow, dailyRow] =
      await db.batch(stmts);
