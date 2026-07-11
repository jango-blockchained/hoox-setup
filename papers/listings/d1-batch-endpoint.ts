// Source: workers/d1-worker/src/index.ts (lines 374-451)
// Listing id: d1-batch-endpoint
// Caption: HTTP /batch: validated statements and atomic DB.batch()
// Batch endpoint
router.post(
  "/batch",
  async (request: Request, env: Env, ctx: ExecutionContext) => {
    const startTime = Date.now();

    try {
      const bodyGuard = requireJsonBody(request);
      if (bodyGuard) return bodyGuard;

      let payload: BatchPayload;
      try {
        payload = await request.json();
      } catch {
        return Errors.badRequest("Invalid JSON in request body");
      }

      if (!payload || !Array.isArray(payload.statements)) {
        return Errors.badRequest("Missing or invalid statements array");
      }

      // Validate all statements before batch execution
      for (const stmt of payload.statements) {
        if (typeof stmt.query !== "string" || !stmt.query.trim()) {
          return Errors.badRequest("Each statement must have a 'query' field");
        }

        const validation = validateQuery(stmt.query);
        if (!validation.valid) {
          logger.warn("Batch statement validation failed", {
            error: validation.error,
            query: stmt.query,
          });
          const statusCode = validation.statusCode || 403;
          if (statusCode === 400) {
            return Errors.badRequest(
              validation.error || "Statement validation failed"
            );
          }
          return Errors.forbidden(
            validation.error || "Statement validation failed"
          );
        }
      }

      // Use native DB.batch() for atomic, faster execution
      const stmts = payload.statements.map((s) => {
        const prepared = env.DB.prepare(s.query);
        if (s.params && s.params.length > 0) {
          return prepared.bind(...s.params);
        }
        return prepared;
      });
      const results = await env.DB.batch(stmts);

      // Check for partial failures
      const failedResult = results.find((r) => r.error);
      const allSuccess = !failedResult;

      // Track API call analytics (non-blocking)
      const latencyMs = Date.now() - startTime;
      ctx.waitUntil(
        trackAnalytics(env, "/track/api-call", {
          worker: "d1-worker",
          endpoint: "/batch",
          latencyMs,
          success: allSuccess,
        }).catch((err) =>
          logger.error("trackAnalytics failed", { error: String(err) })
        )
      );

      if (!allSuccess) {
        return createJsonResponse({
          success: false,
          error: failedResult.error || "Batch statement failed",
          results,
        });
