/**
 * `hoox tui` command — launch the OpenTUI terminal operations center.
 *
 * Spawns the TUI as a child Bun process so it can take over the terminal
 * with alternate screen mode. When the TUI exits, control returns to the CLI.
 */
import { Command } from "commander";
import { spawn } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import { theme } from "../../utils/theme.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import { withErrorHandling } from "../../utils/error-handler.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Resolve the TUI entry point relative to the monorepo root */
function resolveTUIEntry(): string {
  // Try monorepo-relative paths first
  const candidates = [
    resolve(__dirname, "../../../../tui/src/main.tsx"), // packages/cli → packages/tui
    resolve(process.cwd(), "packages/tui/src/main.tsx"), // CWD = repo root
    resolve(process.cwd(), "../tui/src/main.tsx"), // CWD = packages/cli
  ];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }

  throw new CLIError(
    "Could not find TUI entry point. Ensure packages/tui/src/main.tsx exists.",
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
