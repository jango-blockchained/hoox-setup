import type { CommandDef, RouterConfig } from "./router.js";
import path from "node:path";
import fs from "node:fs";

function buildCommands(): Record<string, CommandDef> {
  return {
    // --- Init Wizard ---
    init: {
      description: "Run the interactive first-time setup wizard",
      options: {
        verbose: { type: "boolean", short: "v", description: "Show detailed progress" },
        "dry-run": { type: "boolean", short: "d", description: "Preview without executing" },
        force: { type: "boolean", short: "f", description: "Skip prompts and use defaults" },
      },
      handler: async (args) => {
        const { runWizard } = await import("../wizard.js");
        await runWizard({
          verbose: args.verbose,
          dryRun: args["dry-run"],
          force: args.force,
        });
      },
    },

    // --- Clone ---
    clone: {
      description: "Clone the main hoox-setup repository",
      args: ["destination"],
      handler: async (_args, positionals) => {
        const { cloneMainRepo } = await import("../cloneCommand.js");
        await cloneMainRepo(positionals[0]);
      },
    },

    // --- Install Bun ---
    "install-bun": {
      description: "Download and install the Bun runtime",
      handler: async () => {
        const { downloadBun } = await import("../installers.js");
        await downloadBun();
      },
    },

    // --- Check Setup ---
    "check-setup": {
      description: "Check the current setup for issues without modifying anything",
      handler: async () => {
        await import("../check-setup.js");
      },
    },

    // --- Config ---
    config: {
      description: "Manage configuration files",
      subcommands: {
        info: {
          description: "Show information about the current configuration format",
          handler: async () => {
            const { green, yellow, red } = await import("../utils.js");
            const workersJsoncPath = path.resolve(process.cwd(), "workers.jsonc");
            const workersExamplePath = path.resolve(process.cwd(), "workers.jsonc.example");
            const pagesJsoncPath = path.resolve(process.cwd(), "pages.jsonc");

            if (await Bun.file(workersJsoncPath).exists()) {
              console.log(green("Using: workers.jsonc (JSONC format)"));
            } else {
              console.log(yellow("No workers.jsonc found. Run 'init' to create one."));
            }
            if (await Bun.file(pagesJsoncPath).exists()) {
              console.log(green("Using: pages.jsonc (JSONC format)"));
            }
            console.log("\nExample files available:");
            if (await Bun.file(workersExamplePath).exists()) {
              console.log(green("- workers.jsonc.example (JSONC format)"));
            } else {
              console.log(red("- workers.jsonc.example not found"));
            }
          },
        },
        setup: {
          description: "Copy example configuration files to their active names",
          handler: async () => {
            const { setupConfigVariables } = await import("../configCommands.js");
            await setupConfigVariables();
          },
        },
      },
      handler: async () => {
        // Show config subcommand help
        const { print_info } = await import("../utils.js");
        print_info("Usage: hoox config <info|setup>");
      },
    },

    // --- Setup ---
    setup: {
      description: "Setup validation, repair, and export commands",
      subcommands: {
        validate: {
          description: "Run pre-flight validation checks",
          options: {
            verbose: { type: "boolean", short: "v", description: "Show detailed output" },
            fix: { type: "boolean", short: "f", description: "Attempt to fix issues automatically" },
          },
          handler: async (args) => {
            const { setupValidate } = await import("../commands/index.js");
            await setupValidate(args.verbose || false, args.fix || false);
          },
        },
        repair: {
          description: "Repair common setup issues",
          handler: async () => {
            const { setupRepair } = await import("../commands/index.js");
            await setupRepair();
          },
        },
        export: {
          description: "Export configuration for backup",
          handler: async () => {
            const { setupExport } = await import("../commands/index.js");
            await setupExport();
          },
        },
      },
      handler: async () => {
        const { print_info } = await import("../utils.js");
        print_info("Usage: hoox setup <validate|repair|export>");
      },
    },

    // --- Cloudflare ---
    cf: {
      description: "Manage Cloudflare resources (d1, r2, kv, secrets, queues, zones)",
      subcommands: {
        d1: {
          description: "D1 database operations",
          handler: async (_args, positionals) => {
            const { cfD1 } = await import("../commands/index.js");
            const action = positionals[0];
            if (action === "list") await cfD1.listD1Databases();
            else if (action === "create" && positionals[1]) await cfD1.createD1Database(positionals[1]);
            else if (action === "delete" && positionals[1]) await cfD1.deleteD1Database(positionals[1]);
            else console.log("Usage: hoox cf d1 <list|create|delete> [name]");
          },
        },
        r2: {
          description: "R2 bucket operations",
          handler: async (_args, positionals) => {
            const { cfR2 } = await import("../commands/index.js");
            const action = positionals[0];
            if (action === "list") await cfR2.listR2Buckets();
            else if (action === "create" && positionals[1]) await cfR2.createR2Bucket(positionals[1]);
            else if (action === "delete" && positionals[1]) await cfR2.deleteR2Bucket(positionals[1]);
            else console.log("Usage: hoox cf r2 <list|create|delete> [name]");
          },
        },
        kv: {
          description: "KV namespace operations",
          handler: async (_args, positionals) => {
            const { cfKV } = await import("../commands/index.js");
            const action = positionals[0];
            if (action === "list") await cfKV.listKVNamespaces();
            else if (action === "create" && positionals[1]) await cfKV.createKVNamespace(positionals[1]);
            else if (action === "delete" && positionals[1]) await cfKV.deleteKVNamespace(positionals[1]);
            else if (action === "get" && positionals[1] && positionals[2]) await cfKV.getKVValue(positionals[1], positionals[2]);
            else if (action === "set" && positionals[1] && positionals[2] && positionals[3]) await cfKV.setKVValue(positionals[1], positionals[2], positionals[3]);
            else console.log("Usage: hoox cf kv <list|create|delete|get|set> [args]");
          },
        },
        secrets: {
          description: "Secret Store operations",
          handler: async (_args, positionals) => {
            const { cfSecrets } = await import("../commands/index.js");
            const action = positionals[0];
            if (action === "list") await cfSecrets.listSecrets();
            else if (action === "get" && positionals[1]) await cfSecrets.getSecretMetadata(positionals[1]);
            else if (action === "set" && positionals[1] && positionals[2]) await cfSecrets.setSecret(positionals[1], positionals[2]);
            else if (action === "delete" && positionals[1]) await cfSecrets.deleteSecret(positionals[1]);
            else console.log("Usage: hoox cf secrets <list|get|set|delete> [args]");
          },
        },
        queues: {
          description: "Queue operations",
          handler: async (_args, positionals) => {
            const { cfQueues } = await import("../commands/index.js");
            const action = positionals[0];
            if (action === "list") await cfQueues.listQueues();
            else if (action === "create" && positionals[1]) await cfQueues.createQueue(positionals[1]);
            else if (action === "delete" && positionals[1]) await cfQueues.deleteQueue(positionals[1]);
            else console.log("Usage: hoox cf queues <list|create|delete> [name]");
          },
        },
        zones: {
          description: "DNS zone operations",
          handler: async (_args, positionals) => {
            const { cfZones } = await import("../commands/index.js");
            const action = positionals[0];
            if (action === "list") await cfZones.listZones();
            else if (action === "dns" && positionals[1]) await cfZones.listDNSRecords(positionals[1]);
            else if (action === "add" && positionals.length >= 4) await cfZones.addDNSRecord(positionals[1], positionals[2], positionals[3], positionals[4]);
            else console.log("Usage: hoox cf zones <list|dns|add> [args]");
          },
        },
      },
      handler: async () => {
        const { print_info } = await import("../utils.js");
        print_info("Usage: hoox cf <d1|r2|kv|secrets|queues|zones> [action]");
      },
    },

    // --- Workers ---
    workers: {
      description: "Manage workers (setup, deploy, dev, status, test)",
      subcommands: {
        clone: {
          description: "Clone selected worker repositories as git submodules",
          options: {
            direct: { type: "boolean", short: "d", description: "Clone directly instead of submodules" },
          },
          handler: async (args) => {
            const { cloneWorkerRepositories } = await import("../workerCommands.js");
            await cloneWorkerRepositories(args.direct || false);
          },
        },
        setup: {
          description: "Configure enabled workers (binds secrets, D1, wrangler.toml)",
          handler: async () => {
            const { loadConfig } = await import("../configUtils.js");
            const { setupWorkers } = await import("../workerCommands.js");
            const config = await loadConfig();
            await setupWorkers(config);
          },
        },
        deploy: {
          description: "Deploy enabled workers and output their URLs",
          handler: async () => {
            const { loadConfig } = await import("../configUtils.js");
            const { deployWorkers } = await import("../workerCommands.js");
            const config = await loadConfig();
            await deployWorkers(config);
          },
        },
        dev: {
          description: "Start local development server for a specific worker",
          args: ["workerName"],
          handler: async (_args, positionals) => {
            const workerName = positionals[0];
            if (!workerName) {
              console.log("Usage: hoox workers dev <workerName>");
              return;
            }
            const { loadConfig } = await import("../configUtils.js");
            const { startDevServer } = await import("../workerCommands.js");
            const config = await loadConfig();
            await startDevServer(config, workerName);
          },
        },
        status: {
          description: "Check the status of all workers",
          handler: async () => {
            const React = await import("react");
            const { createCliRenderer } = await import("@opentui/core");
            const { createRoot } = await import("@opentui/react");
            const { StatusView } = await import("../views/StatusView.js");

            const renderer = await createCliRenderer();
            createRoot(renderer).render(React.createElement(StatusView));
          },
        },
        test: {
          description: "Run tests for a specific or all enabled workers",
          args: ["workerName"],
          options: {
            watch: { type: "boolean", short: "w", description: "Run tests in watch mode" },
            coverage: { type: "boolean", short: "c", description: "Run tests with coverage" },
          },
          handler: async (args, positionals) => {
            const { loadConfig } = await import("../configUtils.js");
            const { runTests } = await import("../workerCommands.js");
            const { print_error } = await import("../utils.js");
            const config = await loadConfig();
            const workerName = positionals[0];
            if (args.watch && !workerName) {
              print_error("Watch mode can only be used when specifying a single worker.");
              process.exit(1);
            }
            await runTests(config, workerName, args);
          },
        },
        "update-internal-urls": {
          description: "Update *_URL variables in wrangler configs",
          handler: async () => {
            const { loadConfig } = await import("../configUtils.js");
            const { updateInternalUrls } = await import("../workerCommands.js");
            const config = await loadConfig();
            await updateInternalUrls(config);
          },
        },
        repair: {
          description: "Repair worker configuration",
          args: ["workerName"],
          handler: async (_args, positionals) => {
            const { workers } = await import("../commands/index.js");
            await workers.repairWorker(positionals[0]);
          },
        },
        logs: {
          description: "Tail worker logs",
          options: {
            worker: { type: "string", short: "w", description: "Worker name to filter" },
            level: { type: "string", short: "l", description: "Log level (info, warn, error)" },
            follow: { type: "boolean", short: "f", description: "Follow logs in real-time" },
          },
          handler: async (args) => {
            const { tailLogs } = await import("../commands/index.js");
            await tailLogs(args.worker, { level: args.level, follow: args.follow });
          },
        },
        metrics: {
          description: "Get worker analytics",
          args: ["workerName"],
          handler: async (_args, positionals) => {
            const { workerMetrics } = await import("../commands/index.js");
            await workerMetrics(positionals[0]);
          },
        },
        versions: {
          description: "List worker versions",
          args: ["workerName"],
          handler: async (_args, positionals) => {
            const { listWorkerVersions } = await import("../commands/index.js");
            await listWorkerVersions(positionals[0]);
          },
        },
        rollback: {
          description: "Rollback worker to a previous version",
          args: ["workerName", "version"],
          handler: async (_args, positionals) => {
            const { rollbackWorker } = await import("../commands/index.js");
            await rollbackWorker(positionals[0], positionals[1]);
          },
        },
      },
      handler: async () => {
        const { print_info } = await import("../utils.js");
        print_info("Usage: hoox workers <clone|setup|deploy|dev|status|test|logs|metrics|versions|rollback>");
      },
    },

    // --- Housekeeping ---
    housekeeping: {
      description: "Run housekeeping tasks to check worker configs and sync status",
      options: {
        verbose: { type: "boolean", short: "v", description: "Show verbose output" },
      },
      handler: async (args) => {
        const { loadConfig } = await import("../configUtils.js");
        const { runHousekeeping } = await import("../housekeeping.js");
        const config = await loadConfig();
        await runHousekeeping(config, args.verbose || false);
      },
    },

    // --- Pages Deploy ---
    pages: {
      description: "Build and deploy dashboard to Cloudflare Pages",
      subcommands: {
        deploy: {
          description: "Deploy the dashboard",
          handler: async () => {
            const { loadConfig } = await import("../configUtils.js");
            const { deployPages } = await import("../workerCommands.js");
            const config = await loadConfig();
            await deployPages(config);
          },
        },
      },
      handler: async () => {
        const { print_info } = await import("../utils.js");
        print_info("Usage: hoox pages deploy");
      },
    },

    // --- WAF ---
    waf: {
      description: "Configure Cloudflare WAF rules for IP Allowlist and Rate Limiting",
      handler: async () => {
        const { loadConfig } = await import("../configUtils.js");
        const { setupWAF } = await import("../wafCommands.js");
        const config = await loadConfig();
        await setupWAF(config);
      },
    },

    // --- R2 Provision ---
    r2: {
      description: "Provision required R2 buckets (hoox-system-logs, etc.)",
      handler: async () => {
        const { provisionR2Buckets } = await import("../commands/r2-provision.js");
        await provisionR2Buckets();
      },
    },

    // --- Keys ---
    keys: {
      description: "Manage local secret keys (.keys/*.env files)",
      subcommands: {
        generate: {
          description: "Generate and store a new secret key",
          args: ["keyName"],
          options: {
            env: { type: "string", short: "e", description: "Environment (local or prod)", default: "local" },
          },
          handler: async (args, positionals) => {
            const { generateKey, setKey } = await import("../keyUtils.js");
            const env = args.env === "prod" ? "prod" : "local";
            const newKey = generateKey(32);
            setKey(positionals[0], newKey, env);
          },
        },
        get: {
          description: "Retrieve a stored secret key value",
          args: ["keyName"],
          options: {
            env: { type: "string", short: "e", description: "Environment (local or prod)", default: "local" },
          },
          handler: async (args, positionals) => {
            const { getKey } = await import("../keyUtils.js");
            const { print_error } = await import("../utils.js");
            const env = args.env === "prod" ? "prod" : "local";
            const keyValue = getKey(positionals[0], env);
            if (keyValue) {
              console.log(keyValue);
            } else {
              print_error(`Key "${positionals[0]}" not found for ${env} environment.`);
              process.exitCode = 1;
            }
          },
        },
        list: {
          description: "List stored secret keys",
          options: {
            env: { type: "string", short: "e", description: "Environment (local or prod)", default: "local" },
          },
          handler: async (args) => {
            const { listKeys } = await import("../keyUtils.js");
            const env = args.env === "prod" ? "prod" : "local";
            listKeys(env);
          },
        },
      },
      handler: async () => {
        const { print_info } = await import("../utils.js");
        print_info("Usage: hoox keys <generate|get|list> [keyName]");
      },
    },

    // --- Secrets ---
    secrets: {
      description: "Manage Cloudflare Secret Store bindings",
      subcommands: {
        check: {
          description: "Check Secret Store binding status for a worker",
          args: ["workerName", "secretName"],
          handler: async (_args, positionals) => {
            const { loadConfig } = await import("../configUtils.js");
            const { checkSecretBindings } = await import("../workerCommands.js");
            const config = await loadConfig();
            await checkSecretBindings(config, positionals[0], positionals[1]);
          },
        },
        "update-cf": {
          description: "Update a Cloudflare Secret Store secret for a worker",
          args: ["secretName", "workerName", "value"],
          handler: async (_args, positionals) => {
            const { updateCfSecret } = await import("../commands/secrets.js");
            await updateCfSecret(positionals[0], positionals[1], positionals[2]);
          },
        },
        guide: {
          description: "Guidance on creating secrets in the Cloudflare Secret Store",
          handler: async () => {
            const { showSecretsGuide } = await import("../commands/secrets.js");
            showSecretsGuide();
          },
        },
      },
      handler: async () => {
        const { print_info } = await import("../utils.js");
        print_info("Usage: hoox secrets <check|update-cf|guide> [args]");
      },
    },

    // --- Logs ---
    logs: {
      description: "Manage worker logs",
      subcommands: {
        download: {
          description: "Download latest logs for a worker from R2",
          args: ["workerName"],
          handler: async (_args, positionals) => {
            const { downloadLogs } = await import("../logCommands.js");
            await downloadLogs(positionals[0]);
          },
        },
      },
      handler: async () => {
        const { print_info } = await import("../utils.js");
        print_info("Usage: hoox logs download <workerName>");
      },
    },

    // --- TUI ---
    tui: {
      description: "Launch the interactive terminal UI",
      handler: async () => {
        const { runTui } = await import("../commands/tui.js");
        await runTui();
      },
    },

    // --- Doctor ---
    doctor: {
      description: "Run unified diagnostics on your Hoox setup",
      handler: async () => {
        const { runDoctor } = await import("../commands/doctor.js");
        await runDoctor();
      },
    },

    // --- Status (Quick) ---
    status: {
      description: "Quick non-interactive status overview",
      handler: async () => {
        const { quickStatus } = await import("../commands/status.js");
        await quickStatus();
      },
    },

    // --- Dashboard ---
    dashboard: {
      description: "Open the dashboard or start the dev server",
      subcommands: {
        dev: {
          description: "Start the Next.js dashboard dev server",
          handler: async () => {
            const { startDashboardDev } = await import("../commands/dashboard.js");
            await startDashboardDev();
          },
        },
      },
      handler: async () => {
        const { openDashboard } = await import("../commands/dashboard.js");
        await openDashboard();
      },
    },
  };
}

export function createConfig(version: string): RouterConfig {
  return {
    name: "Hoox",
    version,
    description: "Edge-Executed Crypto Trading System CLI",
    commands: buildCommands(),
  };
}
