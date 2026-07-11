// Source: workers/hoox/src/handlers/webhook.ts (lines 87-134)
// Listing id: webhook-parallel-checks
// Caption: Gateway parallel pre-flight checks (kill switch, IP, API key, rate limit)
    // Run independent checks in parallel (all KV reads, no dependencies)
    const [ksCheck, ipCheck, isValid] = await Promise.all([
      checkKillSwitch(env.CONFIG_KV),
      checkIpAllowlist(env.CONFIG_KV, clientIp),
      validateApiKeyBinding(apiKey, env.WEBHOOK_API_KEY_BINDING, logger),
    ]);

    // Evaluate in priority order (fail-fast)
    if (ksCheck.enabled) {
      logger.warn("[handleRequest] Kill switch active -- rejecting request");
      return wrapResponse(
        createJsonResponse(
          { success: false, error: "Service temporarily disabled" },
          503
        )
      );
    }

    if (!ipCheck.allowed) {
      logger.warn(`[handleRequest] IP ${clientIp} rejected: ${ipCheck.reason}`);
      return wrapResponse(
        createJsonResponse(
          { success: false, error: `Access denied: ${ipCheck.reason}` },
          403
        )
      );
    }

    if (!isValid) {
      logger.warn("[handleRequest] Invalid apiKey provided");
      return wrapResponse(
        createJsonResponse({ success: false, error: "Forbidden" }, 403)
      );
    }

    // Get or create session for tracking (use validated apiKey before it's removed)
    const session = await getOrCreateSession(env.SESSIONS_KV, apiKey);

    // Check rate limit using session ID (not request UUID -- was broken before)
    if (!(await checkRateLimit(session.sessionId, env))) {
      logger.warn("[handleRequest] Rate limit exceeded");
      return wrapResponse(
        createJsonResponse(
          { success: false, error: "Rate limit exceeded. Try again later." },
          429
        )
      );
    }
