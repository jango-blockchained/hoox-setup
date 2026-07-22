/**
 * `hoox tui` command — launch the OpenTUI terminal operations center.
 *
 * Spawns the TUI as a child Bun process so it can take over the terminal
 * with alternate screen mode. When the TUI exits, control returns to the CLI.
 *
 * Entry resolution order:
 *   1. HOOX_TUI_ENTRY env (explicit file)
 *   2. Runtime monorepo (HOOX_REPO → cwd walk-up → ~/.hoox/repo)
 *   3. Paths relative to this CLI module (linked monorepo / workspace)
 *   4. Installed `@jango-blockchained/hoox-tui` package (node_modules)
 *   5. CWD-relative node_modules lookup
 */
import { Command } from "commander";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import {
  getHooxRepoPath,
  getTuiEntryCandidates,
  resolveHooxRuntimeRoot,
} from "@jango-blockchained/hoox-shared";
import { theme } from "../../utils/theme.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import { withErrorHandling } from "../../utils/error-handler.js";
import { resolveGatewayUrl } from "../../services/perf/endpoint-resolver.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const TUI_PKG = "@jango-blockchained/hoox-tui";

/**
 * Collect candidate entry paths for the TUI main module.
 * Prefers source (dev) then dist (built package).
 */
function collectTuiCandidates(): string[] {
  const candidates: string[] = [];

  const explicit = process.env.HOOX_TUI_ENTRY?.trim();
  if (explicit) {
    candidates.push(resolve(explicit));
  }

  const runtime = resolveHooxRuntimeRoot();
  if (runtime.root) {
    candidates.push(...getTuiEntryCandidates(runtime.root));
  }

  // Always consider global repo even if markers failed (partial checkout)
  candidates.push(...getTuiEntryCandidates(getHooxRepoPath()));

  // Monorepo layouts relative to this CLI module
  candidates.push(
    resolve(__dirname, "../../../../tui/src/main.tsx"),
    resolve(__dirname, "../../../../tui/dist/main.js"),
    resolve(__dirname, "../../../tui/src/main.tsx"),
    resolve(__dirname, "../../../tui/dist/main.js"),
    resolve(process.cwd(), "packages/tui/src/main.tsx"),
    resolve(process.cwd(), "packages/tui/dist/main.js"),
    resolve(process.cwd(), "../tui/src/main.tsx"),
    resolve(process.cwd(), "../tui/dist/main.js")
  );

  // Resolve installed package from this module's resolution paths
  pushPackageEntries(candidates, require);

  // Also try from the user's cwd (local project node_modules)
  try {
    const cwdRequire = createRequire(join(process.cwd(), "package.json"));
    pushPackageEntries(candidates, cwdRequire);
  } catch {
    // no package.json in cwd — skip
  }

  // Deduplicate while preserving order
  return [...new Set(candidates)];
}

function pushPackageEntries(candidates: string[], req: NodeRequire): void {
  try {
    const pkgJsonPath = req.resolve(`${TUI_PKG}/package.json`);
    const root = dirname(pkgJsonPath);
    candidates.push(
      join(root, "src/main.tsx"),
      join(root, "dist/main.js"),
      join(root, "src/main.ts")
    );
  } catch {
    // package not installed for this require context
  }
}

/** Resolve the TUI entry point or throw a helpful CLIError. */
export function resolveTUIEntry(): string {
  const candidates = collectTuiCandidates();
  for (const path of candidates) {
    if (existsSync(path)) return path;
  }

  const runtime = resolveHooxRuntimeRoot();
  const globalRepo = getHooxRepoPath();

  throw new CLIError(
    [
      "Could not find the Hoox TUI entry point.",
      "",
      `  Runtime root: ${runtime.root ?? "(none)"} [${runtime.source}]`,
      `  Global repo:  ${globalRepo}`,
      "",
      "Fix options:",
      "  • Bootstrap the global runtime:",
      "      hoox doctor --fix-runtime",
      "  • Or run from a hoox-setup checkout (packages/tui/src/main.tsx)",
      "  • Or set HOOX_REPO=/path/to/hoox-setup",
      "  • Or set HOOX_TUI_ENTRY=/path/to/main.tsx",
      "",
      "Then re-run: hoox tui",
    ].join("\n"),
    ExitCode.ERROR
  );
}

export type TuiMode = "local" | "remote";

export interface TuiLaunchOptions {
  /** Explicit API base URL from `--api-url` (highest priority). */
  apiUrl?: string;
  /** Connect to the deployed gateway via `resolveGatewayUrl()`. */
  remote?: boolean;
}

export interface TuiLaunchConfig {
  apiBase: string;
  tuiMode: TuiMode;
  /** Which resolution branch produced this config (for dev logging). */
  source: "api-url" | "remote-gateway" | "local-default";
}

/**
 * Resolve API base URL + LOCAL/REMOTE mode for `hoox tui`.
 *
 * Priority:
 *   1. `--api-url` → remote mode, use URL as-is (trailing slashes stripped)
 *   2. `--remote`  → remote mode, `resolveGatewayUrl()` (HOOX_GATEWAY_URL / CF account)
 *   3. neither     → local mode, `HOOX_API_URL` or `http://localhost:8787`
 *
 * @param options Commander option bag (or partial for tests)
 * @param resolveRemote Injected gateway resolver (default: production `resolveGatewayUrl`)
 */
export function resolveTuiLaunchConfig(
  options: TuiLaunchOptions,
  resolveRemote: () => string = resolveGatewayUrl
): TuiLaunchConfig {
  if (options.apiUrl) {
    return {
      apiBase: options.apiUrl.replace(/\/+$/, ""),
      tuiMode: "remote",
      source: "api-url",
    };
  }

  if (options.remote) {
    try {
      return {
        apiBase: resolveRemote().replace(/\/+$/, ""),
        tuiMode: "remote",
        source: "remote-gateway",
      };
    } catch {
      throw new CLIError(
        [
          "Cannot resolve hoox gateway URL.",
          "",
          "Set one of:",
          "  • HOOX_GATEWAY_URL=https://your-gateway.workers.dev",
          "  • CLOUDFLARE_ACCOUNT_ID=<your-account-id>",
          "",
          "Or pass an explicit URL: hoox tui --api-url https://...",
        ].join("\n"),
        ExitCode.ERROR
      );
    }
  }

  return {
    apiBase: process.env.HOOX_API_URL || "http://localhost:8787",
    tuiMode: "local",
    source: "local-default",
  };
}

/** True when HOOX_DEBUG / TUI_DEBUG request verbose launch diagnostics. */
function isDevLogEnabled(): boolean {
  const v = process.env.HOOX_DEBUG ?? process.env.TUI_DEBUG ?? "";
  return v === "1" || v === "true" || v === "yes";
}

export function registerTUICommand(program: Command): void {
  program
    .command("tui")
    .description("Launch the OpenTUI terminal operations center")
    .option("--fps <number>", "Target frames per second", "30")
    .option("--no-mouse", "Disable mouse support")
    .option("--remote", "Connect to the deployed Cloudflare gateway")
    .option("--api-url <url>", "Explicit API base URL (overrides --remote)")
    .option("--debug", "Enable TUI dev logging (HOOX_DEBUG=1 → debug.log)")
    .action(
      withErrorHandling(
        async (options) => {
          const tuiEntry = resolveTUIEntry();
          const { apiBase, tuiMode, source } = resolveTuiLaunchConfig(options);

          const modeLabel = tuiMode === "remote" ? "REMOTE" : "LOCAL";
          console.log(
            theme.heading("\nLaunching HOOX Terminal Operations Center...\n")
          );
          console.log(theme.dim(`  Entry: ${tuiEntry}`));
          console.log(theme.dim(`  Mode:  ${modeLabel}`));
          console.log(theme.dim(`  API:   ${apiBase}`));
          console.log(theme.dim(`  FPS:   ${options.fps}`));
          console.log(
            theme.dim(`  Mouse: ${options.mouse ? "enabled" : "disabled"}\n`)
          );

          const debugEnabled = Boolean(options.debug) || isDevLogEnabled();
          if (debugEnabled) {
            console.log(theme.dim(`  Debug: enabled (source=${source})`));
            console.log(
              theme.dim(`         log → $HOME/.hoox/.tui-state/debug.log\n`)
            );
          }

          // Spawn the TUI as a child process — it takes over the terminal
          const child = spawn("bun", ["run", tuiEntry], {
            stdio: "inherit", // TUI gets full terminal control
            env: {
              ...process.env,
              TUI_FPS: options.fps,
              TUI_MOUSE: options.mouse ? "1" : "0",
              HOOX_API_URL: apiBase,
              HOOX_TUI_MODE: tuiMode,
              ...(debugEnabled ? { HOOX_DEBUG: "1", TUI_DEBUG: "1" } : {}),
            },
          });

          // Wait for TUI to exit
          await new Promise<void>((resolveChild, reject) => {
            child.on("close", (code) => {
              if (code === 0) {
                console.log(theme.dim("\nTUI session ended.\n"));
                resolveChild();
              } else if (code !== null) {
                console.log(theme.dim(`\nTUI exited with code ${code}\n`));
                resolveChild();
              } else {
                reject(
                  new CLIError(
                    "TUI process terminated abnormally",
                    ExitCode.ERROR
                  )
                );
              }
            });

            child.on("error", (err) => {
              reject(
                new CLIError(
                  `Failed to launch TUI: ${err.message}`,
                  ExitCode.ERROR
                )
              );
            });
          });
        },
        { service: "tui" }
      )
    );
}
