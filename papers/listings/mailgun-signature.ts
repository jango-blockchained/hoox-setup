// Source: workers/email-worker/src/index.ts (lines 121-161)
// Listing id: mailgun-signature
// Caption: Mailgun webhook HMAC-SHA256 verification
async function handleMailgunWebhook(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  const signature = request.headers.get("Mailgun-Signature");
  const timestamp = request.headers.get("Mailgun-Timestamp");
  const token = request.headers.get("Mailgun-Token");

  if (!signature || !timestamp || !token) {
    return Errors.unauthorized("Missing Mailgun signature headers");
  }

  const apiKey = env.MAILGUN_API_KEY;
  if (!apiKey) {
    logger.error("MAILGUN_API_KEY not configured");
    return Errors.internal("Service configuration error");
  }

  const dataToSign = timestamp + token;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(apiKey),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(dataToSign)
  );
  const expectedSignature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (!timingSafeEqual(signature, expectedSignature)) {
    logger.warn("Invalid Mailgun signature");
    return Errors.unauthorized("Invalid signature");
  }
