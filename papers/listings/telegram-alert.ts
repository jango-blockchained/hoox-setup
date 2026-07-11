// Source: workers/telegram-worker/src/index.ts (lines 125-155)
// Listing id: telegram-alert
// Caption: Internal /alert endpoint with requireInternalAuth gate
async function handleAlertRequest(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  let incomingRequestId = "unknown";

  try {
    const body: TelegramProcessRequestBody = await request.json();
    incomingRequestId = body.requestId || "unknown";

    const authResult = requireInternalAuth(request, env);
    if (authResult) return authResult;

    const result = await sendTelegramNotification(
      body.payload,
      env,
      ctx,
      logger,
      incomingRequestId
    );

    return createJsonResponse({ success: true, result }, 200);
  } catch (error: unknown) {
    const errorMsg = toError(error, "Internal Server Error");
    logger.error(`[${incomingRequestId}] Error in handleProcessRequest:`, {
      error: errorMsg,
    });
    return Errors.internal(errorMsg);
  }
}
