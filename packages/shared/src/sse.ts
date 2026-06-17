/**
 * SSE Streaming Client — subscribes to Server-Sent Events from hoox-setup API.
 *
 * Uses Bun's native fetch with ReadableStream reader for SSE parsing.
 * Supports reconnection with exponential backoff.
 * Events must be JSON-encoded in the "data:" field.
 */

const API_BASE = process.env.HOOX_API_URL || "http://localhost:8787";
const API_TOKEN = process.env.HOOX_API_TOKEN || "";

/** Reconnection backoff: 1s initial, max 16s */
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 16000;
const MAX_RECONNECT_ATTEMPTS = 10;

// ─── Types ───────────────────────────────────────────────────────────────────

export type SSECallback<T> = (event: T) => void;
export type SSEStatusCallback = (
  status: "connected" | "reconnecting" | "disconnected"
) => void;

interface SSESubscription {
  abort: () => void;
}

// ─── Core SSE Stream ─────────────────────────────────────────────────────────

/**
 * Subscribe to an SSE endpoint and invoke the callback for each parsed event.
 *
 * Automatically reconnects on connection loss with exponential backoff.
 * Returns an object with an `abort()` method to cancel the subscription.
 *
 * @param path     API path (e.g. "/trades/stream")
 * @param callback Called with each parsed event of type T
 * @param onStatus Optional callback for connection status updates
 * @returns        Subscription controller with abort method
 */
export function subscribeSSE<T>(
  path: string,
  callback: SSECallback<T>,
  onStatus?: SSEStatusCallback
): SSESubscription {
  let aborted = false;

  const run = async () => {
    let attempt = 0;

    while (!aborted && attempt < MAX_RECONNECT_ATTEMPTS) {
      try {
        const url = `${API_BASE}${path}`;
        const response = await fetch(url, {
          headers: {
            Accept: "text/event-stream",
            ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
          },
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE connection failed: HTTP ${response.status}`);
        }

        // Reset attempt counter on successful connection
        attempt = 0;
        onStatus?.("connected");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last (potentially incomplete) line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6)) as T;
                callback(parsed);
              } catch {
                // Skip malformed events — log at debug level only
              }
            }
            // SSE comments (lines starting with ":") and empty lines are ignored
          }
        }
      } catch {
        if (aborted) break;

        onStatus?.("reconnecting");

        // Exponential backoff
        const delay = Math.min(
          RECONNECT_BASE_MS * Math.pow(2, attempt),
          RECONNECT_MAX_MS
        );
        attempt++;

        // Wait before reconnecting
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    if (!aborted) {
      onStatus?.("disconnected");
    }
  };

  // Start the SSE loop (don't await — it runs forever)
  run();

  return {
    abort: () => {
      aborted = true;
    },
  };
}
