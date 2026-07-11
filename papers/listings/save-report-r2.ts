// Source: workers/trade-worker/src/reports.ts (lines 23-74)
// Listing id: save-report-r2
// Caption: R2 trade report archival with hierarchical key paths
export async function saveReportToR2(
  reportData: unknown, // The trade result or formatted report data
  payload: WebhookPayload,
  dbLogId: string | null, // Changed to string
  env: ReportsEnv
): Promise<void> {
  if (!env.REPORTS_BUCKET) {
    logger.error(
      "REPORTS_BUCKET binding is not configured. Skipping report save.",
      { dbLogId }
    );
    return;
  }

  try {
    // Format a simple report (can be expanded later)
    const reportContent = JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        tradePayload: payload,
        tradeResult: reportData,
        dbLogId: dbLogId,
      },
      null,
      2
    );

    // Generate a unique filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-"); // Filesystem-friendly timestamp
    const filename = `trade-reports/${payload.exchange}/${payload.symbol}/${timestamp}-${dbLogId || "no-id"}.json`;

    logger.info("Attempting to save report to R2", { dbLogId, filename });

    // Put the object into the R2 bucket
    const r2Object = await env.REPORTS_BUCKET.put(filename, reportContent, {
      httpMetadata: { contentType: "application/json" },
      // Optionally add custom metadata
      // customMetadata: {
      //   exchange: payload.exchange,
      //   symbol: payload.symbol,
      //   action: payload.action,
      // },
    });

    logger.info("Successfully saved report to R2", {
      dbLogId,
      etag: r2Object?.etag,
    });
  } catch (error: unknown) {
    const errorMsg = toError(error, "Unknown R2 error");
    logger.error("Failed to save report to R2", { dbLogId, error: errorMsg });
  }
