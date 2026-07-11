// Source: workers/report-worker/src/index.ts (lines 105-133)
// Listing id: report-generate
// Caption: Scheduled PDF generation, R2 archival, fire-and-forget Telegram
async function generateAndStoreReport(
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  if (!env.D1_SERVICE) {
    logger.warn(
      "D1_SERVICE binding not configured -- skipping report generation"
    );
    return;
  }

  try {
    const summary = await fetchPortfolioSummary(env);
    const html = buildReportHtml(summary);
    const pdfBuffer = await generatePdf(html, env);
    const key = `${REPORTS_PREFIX}daily-${Date.now()}.pdf`;
    await env.REPORTS_BUCKET.put(key, pdfBuffer, {
      httpMetadata: { contentType: "application/pdf" },
    });
    // Notification is fire-and-forget: don't block on it
    ctx.waitUntil(
      sendNotification(env, key, summary).catch((err) =>
        logger.error("sendNotification failed", { error: String(err) })
      )
    );
  } catch (err) {
    logger.error("Failed to generate report", { error: err });
  }
}
