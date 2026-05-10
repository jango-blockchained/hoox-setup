/**
 * Types for the `hoox init` interactive setup wizard.
 */

/** CLI flags for non-interactive mode. */
export interface InitOptions {
  /** --token: Cloudflare API token (non-interactive mode) */
  token?: string;
  /** --account: Cloudflare account ID (non-interactive mode) */
  account?: string;
  /** --secret-store: Secret Store ID (non-interactive mode) */
  secretStore?: string;
  /** --prefix: Subdomain prefix (non-interactive mode) */
  prefix?: string;
  /** --accept-risk: Skip the risk acknowledgment confirmation */
  acceptRisk?: boolean;
}

/** Definition of an integration that can be enabled during setup. */
export interface IntegrationConfig {
  /** Unique key used for the multiselect value. */
  key: string;
  /** Display label shown in the multiselect prompt. */
  label: string;
  /** Which worker this integration maps to in wrangler.jsonc. */
  workerName: string;
  /** Secrets that must be collected for this integration (name → prompt label). */
  secrets: Record<string, string>;
  /** Extra non-secret environment variables for the worker. */
  vars?: Record<string, string>;
}

/** Shape of a single worker entry in wrangler.jsonc. */
export interface WorkerConfig {
  enabled: boolean;
  path: string;
  vars: Record<string, string>;
  secrets: string[];
}

/** Shape of the wrangler.jsonc file. */
export interface WorkersJsonConfig {
  global: {
    cloudflare_api_token: string;
    cloudflare_account_id: string;
    cloudflare_secret_store_id: string;
    subdomain_prefix: string;
  };
  workers: Record<string, WorkerConfig>;
}

/**
 * All supported integrations.
 * Exchanges (Binance, MEXC, Bybit) map to trade-worker.
 * Wallet maps to web3-wallet-worker, email to email-worker,
 * telegram to telegram-worker.
 */
export const INTEGRATIONS: IntegrationConfig[] = [
  {
    key: "binance",
    label: "Binance Exchange",
    workerName: "trade-worker",
    secrets: {
      BINANCE_API_KEY: "Binance API Key",
      BINANCE_API_SECRET: "Binance API Secret",
    },
  },
  {
    key: "mexc",
    label: "MEXC Exchange",
    workerName: "trade-worker",
    secrets: {
      MEXC_API_KEY: "MEXC API Key",
      MEXC_API_SECRET: "MEXC API Secret",
    },
  },
  {
    key: "bybit",
    label: "Bybit Exchange",
    workerName: "trade-worker",
    secrets: {
      BYBIT_API_KEY: "Bybit API Key",
      BYBIT_API_SECRET: "Bybit API Secret",
    },
  },
  {
    key: "wallet",
    label: "Web3 Wallet (on-chain execution)",
    workerName: "web3-wallet-worker",
    secrets: {
      WALLET_MNEMONIC_SECRET: "Wallet Mnemonic Phrase",
      WALLET_PK_SECRET: "Wallet Private Key",
    },
  },
  {
    key: "email",
    label: "Email Signal Parsing",
    workerName: "email-worker",
    secrets: {
      EMAIL_HOST: "Email Host (IMAP server)",
      EMAIL_USER: "Email Username",
      EMAIL_PASS: "Email Password",
      INTERNAL_KEY: "Internal Auth Key",
    },
    vars: {
      USE_IMAP: "false",
    },
  },
  {
    key: "telegram",
    label: "Telegram Notifications",
    workerName: "telegram-worker",
    secrets: {
      TELEGRAM_BOT_TOKEN: "Telegram Bot Token",
    },
  },
];

/**
 * Base workers that are always enabled regardless of integration selection.
 */
export const BASE_WORKERS: Record<string, Omit<WorkerConfig, "secrets">> = {
  "d1-worker": {
    enabled: true,
    path: "workers/d1-worker",
    vars: { database_name: "my-database" },
  },
  hoox: {
    enabled: true,
    path: "workers/hoox",
    vars: {},
  },
  "agent-worker": {
    enabled: true,
    path: "workers/agent-worker",
    vars: {},
  },
  "analytics-worker": {
    enabled: true,
    path: "workers/analytics-worker",
    vars: {},
  },
};

/**
 * Base secrets for base workers (not integration-driven).
 */
export const BASE_SECRETS: Record<string, string[]> = {
  hoox: ["WEBHOOK_API_KEY_BINDING"],
  "agent-worker": ["AGENT_INTERNAL_KEY"],
  "analytics-worker": ["CLOUDFLARE_API_TOKEN"],
  "trade-worker": ["API_SERVICE_KEY"],
};
