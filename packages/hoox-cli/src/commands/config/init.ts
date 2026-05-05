import * as p from "@clack/prompts";
import ansis from "ansis";
import { parse as parseJsonc } from "jsonc-parser";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

interface InitConfig {
  apiToken: string;
  accountId: string;
  secretStoreId: string;
  subdomainPrefix: string;
}

export class ConfigInitCommand implements Command {
  name = "config:init";
  description = "Initialize Hoox configuration";
  options = [
    {
      flag: "token",
      short: "t",
      type: "string" as const,
      description: "Cloudflare API Token",
    },
    {
      flag: "account",
      short: "a",
      type: "string" as const,
      description: "Cloudflare Account ID",
    },
    {
      flag: "secret-store",
      short: "s",
      type: "string" as const,
      description: "Cloudflare Secret Store ID",
    },
    {
      flag: "prefix",
      short: "p",
      type: "string" as const,
      description: "Subdomain prefix for workers",
    },
    {
      flag: "force",
      short: "f",
      type: "boolean" as const,
      description: "Force re-initialization (overwrite existing config)",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: {
        token: ctx.args?.token,
        account: ctx.args?.account,
        secretStore: ctx.args?.secretStore,
        prefix: ctx.args?.prefix,
        force: ctx.args?.force,
      },
    });

    try {
      p.intro(ansis.cyan("Hoox Configuration Initializer"));

      // Check for existing configuration
      const envLocalPath = `${ctx.cwd}/.env.local`;
      const workersJsoncPath = `${ctx.cwd}/workers.jsonc`;
      const force = ctx.args?.force as boolean | undefined;

      const envLocalExists = await this.fileExists(envLocalPath);
      const workersJsoncExists = await this.fileExists(workersJsoncPath);

      if ((envLocalExists || workersJsoncExists) && !force) {
        const existingFiles: string[] = [];
        if (envLocalExists) existingFiles.push(".env.local");
        if (workersJsoncExists) existingFiles.push("workers.jsonc");

        p.log.warn(
          `Found existing configuration: ${existingFiles.join(", ")}`
        );

        const overwrite = await p.confirm({
          message: "Do you want to overwrite the existing configuration?",
          initialValue: false,
        });

        if (p.isCancel(overwrite) || !overwrite) {
          p.cancel("Initialization cancelled. Use --force to skip this prompt.");
          return;
        }
      }

      // Collect configuration values
      const config = await this.collectConfig(ctx);
      if (!config) return; // User cancelled

      // Validate API token with wrangler whoami
      const spinner = p.spinner();
      spinner.start("Validating Cloudflare API token...");

      const isValid = await this.validateApiToken(ctx, config.apiToken);

      if (!isValid) {
        spinner.stop("Token validation failed", 1);
        p.log.error(
          "Cloudflare API token is invalid. Please check your token and try again."
        );
        ctx.observer.setState({
          commandStatus: "error",
          lastError: new CLIError(
            "Invalid Cloudflare API token",
            "INVALID_TOKEN",
            true
          ),
        });
        return;
      }

      spinner.stop("Token validated successfully!");

      // Create .env.local from .env.example
      const createdFiles: string[] = [];

      const envCreated = await this.createEnvLocal(ctx, config);
      if (envCreated) createdFiles.push(".env.local");

      // Create/update workers.jsonc
      const workersJsoncCreated = await this.createWorkersJsonc(ctx, config);
      if (workersJsoncCreated) createdFiles.push("workers.jsonc");

      // Show summary
      p.log.success(ansis.green("Configuration initialized successfully!"));

      p.log.info("");
      p.log.info(ansis.bold("Created/updated files:"));
      for (const file of createdFiles) {
        p.log.info(`  ${ansis.green("✓")} ${file}`);
      }

      p.log.info("");
      p.log.info(ansis.bold("Configuration summary:"));
      p.log.info(`  Cloudflare Account ID: ${ansis.cyan(config.accountId)}`);
      p.log.info(`  Secret Store ID:       ${ansis.cyan(config.secretStoreId)}`);
      p.log.info(`  Subdomain Prefix:     ${ansis.cyan(config.subdomainPrefix)}`);
      p.log.info(`  API Token:            ${ansis.cyan(this.maskToken(config.apiToken))}`);

      p.outro(
        `You can now deploy workers with: ${ansis.bold("hoox workers deploy")}`
      );

      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
              "INIT_FAILED",
              false
            );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  private async collectConfig(ctx: CommandContext): Promise<InitConfig | null> {
    // Get API Token
    let apiToken = ctx.args?.token as string | undefined;
    if (!apiToken) {
      const input = await p.password({
        message: "Cloudflare API Token:",
        validate: (v) => (!v ? "API Token is required" : undefined),
      });
      if (p.isCancel(input)) {
        p.cancel("Initialization cancelled.");
        return null;
      }
      apiToken = input;
    } else {
      p.log.info(`  Using provided ${ansis.cyan("--token")} flag`);
    }

    // Get Account ID
    let accountId = ctx.args?.account as string | undefined;
    if (!accountId) {
      const input = await p.text({
        message: "Cloudflare Account ID:",
        validate: (v) => (!v ? "Account ID is required" : undefined),
      });
      if (p.isCancel(input)) {
        p.cancel("Initialization cancelled.");
        return null;
      }
      accountId = input;
    } else {
      p.log.info(`  Using provided ${ansis.cyan("--account")} flag`);
    }

    // Get Secret Store ID
    let secretStoreId = ctx.args?.secretStore as string | undefined;
    if (!secretStoreId) {
      const input = await p.text({
        message: "Cloudflare Secret Store ID:",
        placeholder: "Leave empty to skip",
      });
      if (p.isCancel(input)) {
        p.cancel("Initialization cancelled.");
        return null;
      }
      secretStoreId = input || "";
    } else {
      p.log.info(`  Using provided ${ansis.cyan("--secret-store")} flag`);
    }

    // Get Subdomain Prefix
    let subdomainPrefix = ctx.args?.prefix as string | undefined;
    if (!subdomainPrefix) {
      const input = await p.text({
        message: "Subdomain prefix for workers:",
        placeholder: "hoox",
        validate: (v) => {
          if (!v) return "Subdomain prefix is required";
          if (!/^[a-z0-9-]+$/.test(v))
            return "Subdomain prefix must be lowercase alphanumeric with hyphens";
          return undefined;
        },
      });
      if (p.isCancel(input)) {
        p.cancel("Initialization cancelled.");
        return null;
      }
      subdomainPrefix = input;
    } else {
      p.log.info(`  Using provided ${ansis.cyan("--prefix")} flag`);
    }

    return { apiToken, accountId, secretStoreId, subdomainPrefix };
  }

  private async validateApiToken(
    ctx: CommandContext,
    token: string
  ): Promise<boolean> {
    try {
      // Use cloudflare adapter's testConnection which runs wrangler whoami
      // Set the token in environment for wrangler to pick up
      const originalEnv = process.env.CLOUDFLARE_API_TOKEN;
      process.env.CLOUDFLARE_API_TOKEN = token;

      try {
        const isValid = await ctx.adapters.cloudflare.testConnection();
        return isValid;
      } finally {
        // Restore original env
        if (originalEnv !== undefined) {
          process.env.CLOUDFLARE_API_TOKEN = originalEnv;
        } else {
          delete process.env.CLOUDFLARE_API_TOKEN;
        }
      }
    } catch {
      return false;
    }
  }

  private async createEnvLocal(
    ctx: CommandContext,
    config: InitConfig
  ): Promise<boolean> {
    const envExamplePath = `${ctx.cwd}/.env.example`;
    const envLocalPath = `${ctx.cwd}/.env.local`;

    let template: string;

    // Try to read .env.example as template
    try {
      template = await ctx.adapters.bun.readFile(envExamplePath);
    } catch {
      // Fallback: create a minimal .env.local if no .env.example exists
      p.log.warn("No .env.example found, creating minimal .env.local");
      template = this.getDefaultEnvTemplate();
    }

    // Replace placeholder values with actual config
    let content = template;
    content = this.replaceEnvValue(
      content,
      "CLOUDFLARE_API_TOKEN",
      config.apiToken
    );
    content = this.replaceEnvValue(
      content,
      "CLOUDFLARE_ACCOUNT_ID",
      config.accountId
    );
    content = this.replaceEnvValue(
      content,
      "CLOUDFLARE_SECRET_STORE_ID",
      config.secretStoreId
    );
    content = this.replaceEnvValue(
      content,
      "SUBDOMAIN_PREFIX",
      config.subdomainPrefix
    );

    await ctx.adapters.bun.writeFile(envLocalPath, content);
    return true;
  }

  private async createWorkersJsonc(
    ctx: CommandContext,
    config: InitConfig
  ): Promise<boolean> {
    const workersJsoncPath = `${ctx.cwd}/workers.jsonc`;
    let workersConfig: Record<string, unknown>;

    // If workers.jsonc exists, read and update it; otherwise create new
    const exists = await this.fileExists(workersJsoncPath);
    if (exists) {
      try {
        const content = await ctx.adapters.bun.readFile(workersJsoncPath);
        const parseResult = parseJsonc(content);
        workersConfig = parseResult as Record<string, unknown>;
      } catch {
        p.log.warn(
          "Existing workers.jsonc is invalid JSON, creating a new one"
        );
        workersConfig = {};
      }
    } else {
      workersConfig = {};
    }

    // Update global section
    const global = (workersConfig.global ?? {}) as Record<string, unknown>;
    global.cloudflare_api_token = "<USE_WRANGLER_SECRET_PUT>";
    global.cloudflare_account_id = config.accountId;
    global.cloudflare_secret_store_id = config.secretStoreId;
    global.subdomain_prefix = config.subdomainPrefix;
    workersConfig.global = global;

    // Ensure workers section exists
    if (!workersConfig.workers) {
      workersConfig.workers = {};
    }

    // Write back as formatted JSON (preserving readability)
    const output = JSON.stringify(workersConfig, null, 2);
    await ctx.adapters.bun.writeFile(workersJsoncPath, output + "\n");
    return true;
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      const file = Bun.file(path);
      return await file.exists();
    } catch {
      return false;
    }
  }

  private maskToken(token: string): string {
    if (token.length <= 8) return "****";
    const maskedLength = Math.max(4, token.length - 8);
    return `${token.slice(0, 4)}${"*".repeat(maskedLength)}${token.slice(-4)}`;
  }

  private replaceEnvValue(
    content: string,
    key: string,
    value: string
  ): string {
    // Match KEY="value" or KEY=value patterns, preserving the quote style
    const regex = new RegExp(
      `(${key}="?)([^"]*?)("?)$`,
      "m"
    );
    return content.replace(regex, `$1${value}$3`);
  }

  private getDefaultEnvTemplate(): string {
    return `# Hoox Main Global Configuration
# Generated by hoox config:init

# ------------------------------------------------------------------------------
# CLOUDFLARE ACCOUNT CONFIGURATION
# ------------------------------------------------------------------------------
CLOUDFLARE_API_TOKEN="your_cloudflare_api_token"
CLOUDFLARE_ACCOUNT_ID="your_cloudflare_account_id"
CLOUDFLARE_SECRET_STORE_ID="your_secret_store_id"
SUBDOMAIN_PREFIX="hoox"

# ------------------------------------------------------------------------------
# GLOBAL SHARED SECRETS
# ------------------------------------------------------------------------------
D1_INTERNAL_KEY="generate_a_secure_random_string_for_d1"
TRADE_INTERNAL_KEY="generate_a_secure_random_string_for_trade"
AGENT_INTERNAL_KEY="generate_a_secure_random_string_for_agent"

# Telegram Bot Token for notification worker
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"

# API keys for the AI Agent Worker
AGENT_OPENAI_KEY="your_openai_api_key"
AGENT_ANTHROPIC_KEY="your_anthropic_api_key"
AGENT_GOOGLE_KEY="your_google_api_key"

# ------------------------------------------------------------------------------
# EXCHANGE CONFIGURATION
# ------------------------------------------------------------------------------
BINANCE_API_KEY="your_binance_api_key"
BINANCE_API_SECRET="your_binance_api_secret"
MEXC_API_KEY="your_mexc_api_key"
MEXC_API_SECRET="your_mexc_api_secret"
BYBIT_API_KEY="your_bybit_api_key"
BYBIT_API_SECRET="your_bybit_api_secret"

# ------------------------------------------------------------------------------
# DASHBOARD SPECIFIC
# ------------------------------------------------------------------------------
DASHBOARD_USER="admin"
DASHBOARD_PASS="secure_password"
SESSION_SECRET="generate_a_32_character_secure_random_string"
`;
  }
}