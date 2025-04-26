// shared/utils.js - Common utility functions

// Timing-safe string comparison (to prevent timing attacks)
export function timingSafeEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

// Create a default trade message
export function createTradeMessage(data) {
  const { exchange, action, symbol, quantity, price } = data;
  let message = `📊 Trade Alert: ${action} ${symbol}\n`;
  message += `📈 Exchange: ${exchange}\n`;
  message += `💰 Quantity: ${quantity}\n`;

  if (price) {
    message += `💵 Price: ${price}\n`;
  }

  return message;
}

// Verify internal service authentication
export function verifyInternalService(request, env) {
  const internalKey = request.headers.get("X-Internal-Key");
  const requestId = request.headers.get("X-Request-ID");

  if (!internalKey || internalKey !== env.INTERNAL_SERVICE_KEY || !requestId) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "Unauthorized",
      }),
      { status: 403 }
    );
  }
}
