// Source: packages/shared/src/schemas/registry.ts (lines 26-75)
// Listing id: registry-hoox
// Caption: hoox worker manifest in shared registry
  hoox: {
    name: "hoox",
    path: "workers/hoox",
    vars: {
      WEBHOOK_API_KEY_BINDING: {
        type: "secret",
        description: "External webhook auth key",
      },
      INTERNAL_KEY_BINDING: {
        type: "secret",
        description: "Inter-worker auth key",
      },
      HA_TOKEN_BINDING: { type: "secret", description: "Home Assistant token" },
    },
    services: [
      {
        binding: "TRADE_SERVICE",
        service: "trade-worker",
        description: "Trading functionality",
      },
      {
        binding: "TELEGRAM_SERVICE",
        service: "telegram-worker",
        description: "Notifications",
      },
    ],
    infrastructure: {
      kv: [
        { binding: "SESSIONS_KV", description: "Webhook session storage" },
        {
          binding: "CONFIG_KV",
          description: "Configuration + rate limiter state",
        },
      ],
      vectorize: [{ binding: "VECTORIZE_INDEX", index: "my-rag-index" }],
      ai: true,
      queues: { producer: ["trade-execution"] },
      durableObjects: [
        { name: "IDEMPOTENCY_STORE", className: "IdempotencyStore" },
      ],
    },
    middleware: [
      "requireAuth",
      "requireInternalAuth",
      "cors",
      "rateLimit",
      "logger",
      "validate",
    ],
  },
