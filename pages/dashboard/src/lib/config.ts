export type AuthType = "basic" | "cf-access" | "none";

const DEFAULT_SERVICE_URLS = {
  D1_SERVICE_URL: "https://d1-worker.cryptolinx.workers.dev",
  TRADE_SERVICE_URL: "https://trade-worker.cryptolinx.workers.dev",
  AGENT_SERVICE_URL: "https://agent-worker.cryptolinx.workers.dev",
  TELEGRAM_SERVICE_URL: "https://telegram-worker.cryptolinx.workers.dev",
} as const;

export const ENV_KEYS = {
  services: {
    d1: "D1_SERVICE_URL",
    trade: "TRADE_SERVICE_URL",
    agent: "AGENT_SERVICE_URL",
    telegram: "TELEGRAM_SERVICE_URL",
  },
  internalAuth: {
    d1: "D1_INTERNAL_KEY",
    agent: "AGENT_INTERNAL_KEY",
    telegram: "TELEGRAM_INTERNAL_KEY",
    api: "API_SERVICE_KEY",
  },
  cloudflare: {
    accountId: "CLOUDFLARE_ACCOUNT_ID",
    apiToken: "CLOUDFLARE_API_TOKEN",
    secretStoreId: "CLOUDFLARE_SECRET_STORE_ID",
  },
  auth: {
    type: "AUTH_TYPE",
    username: "DASHBOARD_USER",
    password: "DASHBOARD_PASS",
    cfAccessTeamName: "CF_ACCESS_TEAM_NAME",
    sessionSecret: "SESSION_SECRET",
  },
} as const;

export function getEnvVar(key: string): string | undefined {
  const value = process.env[key];
  return value && value.length > 0 ? value : undefined;
}

export function getConfig() {
  return {
    api: {
      d1Service:
        getEnvVar(ENV_KEYS.services.d1) || DEFAULT_SERVICE_URLS.D1_SERVICE_URL,
      tradeService:
        getEnvVar(ENV_KEYS.services.trade) ||
        DEFAULT_SERVICE_URLS.TRADE_SERVICE_URL,
      agentService:
        getEnvVar(ENV_KEYS.services.agent) ||
        DEFAULT_SERVICE_URLS.AGENT_SERVICE_URL,
      telegramService:
        getEnvVar(ENV_KEYS.services.telegram) ||
        DEFAULT_SERVICE_URLS.TELEGRAM_SERVICE_URL,
    },
    internalAuth: {
      d1: getEnvVar(ENV_KEYS.internalAuth.d1),
      agent: getEnvVar(ENV_KEYS.internalAuth.agent),
      telegram: getEnvVar(ENV_KEYS.internalAuth.telegram),
      api: getEnvVar(ENV_KEYS.internalAuth.api),
    },
    auth: {
      type: (getEnvVar(ENV_KEYS.auth.type) as AuthType) || "basic",
      username: getEnvVar(ENV_KEYS.auth.username),
      password: getEnvVar(ENV_KEYS.auth.password),
      cfAccessTeamName: getEnvVar(ENV_KEYS.auth.cfAccessTeamName),
      sessionSecret:
        getEnvVar(ENV_KEYS.auth.sessionSecret) || "change-me-in-production",
    },
  } as const;
}

export const config = getConfig();

export type ConfigError = {
  key: string;
  message: string;
};

export function validateRequiredEnv(keys: readonly string[]): ConfigError[] {
  return keys
    .filter((key) => !getEnvVar(key))
    .map((key) => ({
      key,
      message: `Missing required environment variable: ${key}`,
    }));
}
