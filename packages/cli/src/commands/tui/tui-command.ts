/**
 * `hoox tui` command — launch the OpenTUI terminal operations center.
 *
 * Spawns the TUI as a child Bun process so it can take over the terminal
 * with alternate screen mode. When the TUI exits, control returns to the CLI.
 *
 * Entry resolution order:
 *   1. Monorepo paths (source + dist)
 *   2. Installed `@jango-blockchained/hoox-tui` package (node_modules)
 *   3. CWD-relative node_modules lookup
 */
import { Command } from "commander";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { theme } from "../../utils/theme.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import { withErrorHandling } from "../../utils/error-handler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const TUI_PKG = "@jango-blockchained/hoox-tui";

/**
 * Collect candidate entry paths for the TUI main module.
 * Prefers source (dev) then dist (built package).
 */
function collectTuiCandidates(): string[] {
  const candidates: string[] = [
    // Monorepo (CLI source: packages/cli/src/commands/tui → packages/tui)
    resolve(__dirname, "../../../../tui/src/main.tsx"),
    resolve(__dirname, "../../../../tui/dist/main.js"),
    // Monorepo (CLI dist: packages/cli/dist → packages/tui)
    resolve(__dirname, "../../../tui/src/main.tsx"),
    resolve(__dirname, "../../../tui/dist/main.js"),
    // CWD layouts
    resolve(process.cwd(), "packages/tui/src/main.tsx"),
    resolve(process.cwd(), "packages/tui/dist/main.js"),
    resolve(process.cwd(), "../tui/src/main.tsx"),
    resolve(process.cwd(), "../tui/dist/main.js"),
  ];

  // Resolve installed package from this module's resolution paths
  pushPackageEntries(candidates, require);

  // Also try from the user's cwd (local project node_modules)
  try {
    const cwdRequire = createRequire(join(process.cwd(), "package.json"));
    pushPackageEntries(candidates, cwdRequire);
  } catch {
    // no package.json in cwd — skip
  }

  return candidates;
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

  throw new CLIError(
    [
      "Could not find the Hoox TUI entry point.",
      "",
      "Fix options:",
      "  • From the monorepo: ensure packages/tui/src/main.tsx exists",
      `  • Or install the package: bun add -g ${TUI_PKG}`,
      "  • Or from a project: bun add -d " + TUI_PKG,
      "",
      "Then re-run: hoox tui",
    ].join("\n"),
    ExitCode.ERROR
  );
}

export function registerTUICommand(program: Command): void {
  program
    .command("tui")
    .description("Launch the OpenTUI terminal operations center")
    .option("--fps <number>", "Target frames per second", "30")
    .option("--no-mouse", "Disable mouse support")
    .action(
      withErrorHandling(
        async (options) => {
          const tuiEntry = resolveTUIEntry();

          console.log(
            theme.heading("\nLaunching HOOX Terminal Operations Center...\n")
          );
          console.log(theme.dim(`  Entry: ${tuiEntry}`));
          console.log(theme.dim(`  FPS:   ${options.fps}`));
          console.log(
            theme.dim(`  Mouse: ${options.mouse ? "enabled" : "disabled"}\n`)
          );

          // Spawn the TUI as a child process — it takes over the terminal
          const child = spawn("bun", ["run", tuiEntry], {
            stdio: "inherit", // TUI gets full terminal control
            env: {
              ...process.env,
              TUI_FPS: options.fps,
              TUI_MOUSE: options.mouse ? "1" : "0",
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
