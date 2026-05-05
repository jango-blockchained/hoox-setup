import { createValidationResult, ValidationResult } from "./validation.js";

export async function checkWorkersJsonc(
  cwd: string
): Promise<ValidationResult> {
  const result = createValidationResult("workers.jsonc");
  const file = Bun.file(`${cwd}/workers.jsonc`);

  if (!(await file.exists())) {
    result.addError(
      "workers.jsonc not found in project root. Run: hoox config:init"
    );
    return result;
  }

  try {
    const content = await file.text();
    const config = JSON.parse(
      content.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")
    );

    if (!config.global?.cloudflare_account_id) {
      result.addError(
        "global.cloudflare_account_id is required in workers.jsonc"
      );
    }
    if (!config.global?.subdomain_prefix) {
      result.addError("global.subdomain_prefix is required in workers.jsonc");
    }
    if (!config.workers || Object.keys(config.workers).length === 0) {
      result.addError("No workers defined in workers.jsonc");
    }
  } catch (err) {
    result.addError(`Invalid JSON in workers.jsonc: ${err}`);
  }

  return result;
}

export async function checkWranglerConfigs(
  cwd: string,
  workers: Record<string, { enabled: boolean; path: string }>
): Promise<ValidationResult> {
  const result = createValidationResult("Wrangler Configs");

  for (const [name, worker] of Object.entries(workers)) {
    if (!worker.enabled) continue;

    const jsoncPath = `${cwd}/${worker.path}/wrangler.jsonc`;
    const tomlPath = `${cwd}/${worker.path}/wrangler.toml`;

    const jsoncFile = Bun.file(jsoncPath);
    const tomlFile = Bun.file(tomlPath);

    if (!(await jsoncFile.exists()) && !(await tomlFile.exists())) {
      result.addError(
        `Worker "${name}" missing wrangler.jsonc/toml at ${worker.path}`
      );
      continue;
    }

    const configFile = (await jsoncFile.exists()) ? jsoncFile : tomlFile;
    const content = await configFile.text();

    if (content.includes("<YOUR_") || content.includes("<PLACEHOLDER")) {
      result.addWarning(`Worker "${name}" config contains placeholder values`);
    }
  }

  return result;
}

export async function checkEnvLocal(cwd: string): Promise<ValidationResult> {
  const result = createValidationResult("Environment");
  const envFile = Bun.file(`${cwd}/.env.local`);

  if (!(await envFile.exists())) {
    result.addError(".env.local not found. Run: cp .env.example .env.local");
    return result;
  }

  const content = await envFile.text();
  const required = ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"];

  for (const key of required) {
    if (!content.includes(`${key}=`) || content.includes(`${key}="your_`)) {
      result.addError(
        `${key} is missing or has placeholder value in .env.local`
      );
    }
  }

  return result;
}

export async function checkSubmodules(cwd: string): Promise<ValidationResult> {
  const result = createValidationResult("Submodules");
  const requiredWorkers = [
    "workers/hoox",
    "workers/trade-worker",
    "workers/agent-worker",
    "workers/d1-worker",
    "workers/telegram-worker",
    "workers/web3-wallet-worker",
    "workers/email-worker",
    "workers/analytics-worker",
  ];

  for (const worker of requiredWorkers) {
    const dirExists = await Bun.file(`${cwd}/${worker}/package.json`).exists();
    if (!dirExists) {
      result.addError(
        `Worker directory missing: ${worker}. Run: git submodule update --init --recursive`
      );
    }
  }

  return result;
}
