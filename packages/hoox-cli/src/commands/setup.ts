import {
  print_success,
  print_error,
  print_warning,
  print_info,
} from "../utils.js";
import {
  validateDependencies,
  validateAuth,
  validateConfig,
  validateWorkers,
  validateResources,
  fixDependencies,
  repairResources,
} from "../lib/validation.js";
import { loadConfig } from "../configUtils.js";
import { CloudflareClient } from "../lib/cf-client.js";

export async function setupValidate(
  verbose: boolean = false,
  fix: boolean = false
): Promise<void> {
  print_info("Running pre-flight validation...\n");

  const results: Array<{
    name: string;
    success: boolean;
    errors: string[];
    warnings: string[];
  }> = [];

  const depsResult = await validateDependencies();
  results.push({ name: "Dependencies", ...depsResult });
  console.log(
    `${depsResult.success ? "✅" : "❌"} Dependencies: ${depsResult.errors.length ? depsResult.errors.join(", ") : "OK"}`
  );
  if (verbose && depsResult.warnings.length) {
    depsResult.warnings.forEach((w) => print_warning(`  Warning: ${w}`));
  }

  if (depsResult.success === false && fix) {
    print_info("Attempting to fix dependencies...");
    const fixResult = await fixDependencies();
    if (fixResult.success) {
      print_success("Dependencies fixed");
    } else {
      print_error(`Could not fix: ${fixResult.errors.join(", ")}`);
    }
  }

  const config = await loadConfig().catch(() => null);
  if (!config) {
    print_error("No configuration found. Run 'hoox init' first.");
    return;
  }

  const authResult = await validateAuth(
    config.global.cloudflare_api_token,
    config.global.cloudflare_account_id
  );
  results.push({ name: "Auth", ...authResult });
  console.log(
    `${authResult.success ? "✅" : "❌"} Auth: ${authResult.errors.length ? authResult.errors.join(", ") : "OK"}`
  );

  if (authResult.success === false) {
    print_error("Auth validation failed. Cannot continue.");
    return;
  }

  const configResult = validateConfig(config);
  results.push({ name: "Config", ...configResult });
  console.log(
    `${configResult.success ? "✅" : "❌"} Config: ${configResult.errors.length ? configResult.errors.join(", ") : "OK"}`
  );

  if (configResult.success === false) {
    print_error("Config validation failed. Please fix your workers.jsonc.");
    return;
  }

  const workersResult = await validateWorkers(config.workers);
  results.push({ name: "Workers", ...workersResult });
  console.log(
    `${workersResult.success ? "✅" : "❌"} Workers: ${workersResult.errors.length ? workersResult.errors.join(", ") : "OK"}`
  );

  const resourcesResult = await validateResources(config);
  results.push({ name: "Resources", ...resourcesResult });
  console.log(
    `${resourcesResult.success ? "✅" : "❌"} Resources: ${resourcesResult.errors.length ? resourcesResult.errors.join(", ") : "OK"}`
  );

  if (resourcesResult.success === false && fix) {
    print_info("Attempting to repair resources...");
    const repairResult = await repairResources(config);
    if (repairResult.success) {
      print_success("Resources repaired");
    } else {
      print_error(`Could not repair: ${repairResult.errors.join(", ")}`);
    }
  }

  const allPassed = results.every((r) => r.success);
  console.log(
    "\n" +
      (allPassed ? "✅ All validations passed" : "❌ Some validations failed")
  );

  if (!allPassed) {
    const failed = results.filter((r) => !r.success).map((r) => r.name);
    print_error(`Failed: ${failed.join(", ")}`);
  }
}

export async function setupRepair(): Promise<void> {
  print_info("Running repair...\n");

  const config = await loadConfig().catch(() => null);
  if (!config) {
    print_error(
      "No configuration found. Running setup:validate --fix first might help."
    );
    return;
  }

  fixDependencies().then(async () => {
    const depsResult = await validateDependencies();
    if (depsResult.success) {
      print_success("Dependencies repaired");
    } else {
      print_warning(
        `Could not repair all dependencies: ${depsResult.errors.join(", ")}`
      );
    }
  });

  const repairResult = await repairResources(config);
  if (repairResult.success) {
    print_success("Resources checked");
  } else {
    print_error(
      `Resource repair needs manual attention: ${repairResult.errors.join(", ")}`
    );
  }

  print_info("\nRun 'hoox workers setup' to reconfigure workers.");
}

export async function setupExport(): Promise<void> {
  print_info("Exporting configuration...\n");

  const config = await loadConfig().catch(() => null);
  if (!config) {
    print_error("No configuration found.");
    return;
  }

  const exportConfig = {
    global: {
      cloudflare_api_token: config.global.cloudflare_api_token
        ? "<TOKENS_REMOVED>"
        : "",
      cloudflare_account_id: config.global.cloudflare_account_id,
      cloudflare_secret_store_id: config.global.cloudflare_secret_store_id
        ? "<SECRET_STORE_ID>"
        : "",
      subdomain_prefix: config.global.subdomain_prefix,
      d1_database_id: config.global.d1_database_id,
    },
    workers: Object.fromEntries(
      Object.entries(config.workers).map(([name, wc]) => [
        name,
        {
          enabled: wc.enabled,
          path: wc.path,
          vars: wc.vars,
          services: wc.services,
          secrets: wc.secrets,
          deployed_url: wc.deployed_url,
        },
      ])
    ),
  };

  console.log(JSON.stringify(exportConfig, null, 2));

  const secretList: string[] = [];
  for (const [, wc] of Object.entries(config.workers)) {
    if (wc.secrets) {
      secretList.push(...wc.secrets);
    }
  }

  if (secretList.length > 0) {
    console.log(
      "\n# Required secrets (set manually in Cloudflare Secret Store):"
    );
    const uniqueSecrets = [...new Set(secretList)];
    uniqueSecrets.forEach((s) => console.log(`# - ${s}`));
  }

  print_info(
    "\nExport complete. Secrets are marked - replace with actual values."
  );
}
