import ansis from "ansis";
import { loadConfig } from "../configUtils.js";
import { printTable, printKeyValue } from "../cli/table.js";
import { checkCommandExists, log } from "../utils.js";

/**
 * `hoox status` — Quick non-interactive status overview.
 * Suitable for CI/CD pipelines and scripting.
 */
export async function quickStatus(): Promise<void> {
  const d = ansis.dim;
  const b = ansis.bold;
  const y = ansis.yellow;

  console.log("");
  console.log(b(y("  ⚡ HOOX")) + d(" — Quick Status"));
  console.log("");

  // System info
  const bunProc = Bun.spawnSync(["bun", "--version"]);
  const bunVersion = bunProc.stdout?.toString().trim() || "—";

  printKeyValue([
    ["Runtime", `Bun v${bunVersion}`, "cyan"],
    ["Platform", `${process.platform}/${process.arch}`],
    ["CWD", process.cwd()],
  ]);
  console.log("");

  // Load config
  let config: any;
  try {
    config = await loadConfig();
  } catch {
    log.error("Could not load workers.jsonc. Run 'hoox init' first.");
    return;
  }

  // Workers overview
  const workers = Object.entries(config.workers || {});
  if (workers.length === 0) {
    log.warn("No workers configured.");
    return;
  }

  const rows = workers.map(([name, wc]: [string, any]) => {
    const enabled = wc.enabled ?? false;
    const hasSecrets = (wc.secrets || []).length;
    const hasServices = (wc.services || []).length;
    const deployedUrl = wc.deployed_url || "—";

    return {
      name,
      status: enabled ? ansis.green("●  enabled") : ansis.dim("○  disabled"),
      secrets: hasSecrets > 0 ? `${hasSecrets}` : d("0"),
      services: hasServices > 0 ? `${hasServices}` : d("0"),
      url: deployedUrl.length > 35 ? deployedUrl.slice(0, 32) + "..." : deployedUrl,
    };
  });

  printTable({
    title: "Workers",
    columns: [
      { key: "name", label: " Worker", width: 22 },
      { key: "status", label: " Status", width: 16 },
      { key: "secrets", label: " Secrets", width: 10, align: "right" },
      { key: "services", label: " Svcs", width: 8, align: "right" },
      { key: "url", label: " Deployed URL", width: 38 },
    ],
    rows,
  });

  // Summary line
  const enabled = workers.filter(([, wc]: [string, any]) => wc.enabled).length;
  const total = workers.length;
  const hasToken = !!config.global?.cloudflare_api_token;
  const hasStore = !!config.global?.cloudflare_secret_store_id;

  printKeyValue([
    ["Workers", `${enabled}/${total} enabled`, enabled > 0 ? "green" : "yellow"],
    ["CF Auth", hasToken ? "Configured" : "Missing", hasToken ? "green" : "red"],
    ["Secret Store", hasStore ? "Configured" : "Missing", hasStore ? "green" : "red"],
  ]);
  console.log("");
}
