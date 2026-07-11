// Source: workers/agent-worker/src/types.ts (lines 58-72)
// Listing id: agent-config
// Caption: Default AgentConfig and provider fallback chain
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  defaultProvider: "workers-ai",
  fallbackChain: ["workers-ai", "openai"],
  modelMap: {
    "workers-ai": "@cf/meta/llama-3.1-8b-instruct",
    openai: "gpt-4o-mini-2024-07-18",
    anthropic: "claude-3-haiku-20240307",
    google: "gemini-1.5-flash-002",
  },
  timeoutMs: 30000,
  retryCount: 3,
  maxDailyDrawdownPercent: -5,
  trailingStopPercent: 0.05,
  takeProfitPercent: 0.1,
};
