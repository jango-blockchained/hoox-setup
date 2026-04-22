export const config = {
  // API endpoints - can be overridden via env
  api: {
    d1Service: process.env.D1_SERVICE_URL || "https://d1-worker.cryptolinx.workers.dev",
    tradeService: process.env.TRADE_SERVICE_URL || "https://trade-worker.cryptolinx.workers.dev",
    agentService: process.env.AGENT_SERVICE_URL || "https://agent-worker.cryptolinx.workers.dev",
    telegramService: process.env.TELEGRAM_SERVICE_URL || "https://telegram-worker.cryptolinx.workers.dev",
  },
  // Auth configuration
  auth: {
    // Auth type: "basic" | "cf-access" | "none"
    type: (process.env.AUTH_TYPE as "basic" | "cf-access" | "none") || "basic",
    // Basic auth credentials (only if AUTH_TYPE=basic)
    username: process.env.DASHBOARD_USER,
    password: process.env.DASHBOARD_PASS,
    // CF Access team name (only if AUTH_TYPE=cf-access)
    cfAccessTeamName: process.env.CF_ACCESS_TEAM_NAME,
    // Session secret for cookie signing
    sessionSecret: process.env.SESSION_SECRET || "change-me-in-production",
  },
} as const;

export type AuthType = "basic" | "cf-access" | "none";
