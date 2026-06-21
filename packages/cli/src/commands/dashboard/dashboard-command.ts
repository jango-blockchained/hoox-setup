/**
 * `hoox dashboard` — Dashboard operations.
 *
 * Subcommands:
 *   dev          Start the dashboard dev server (alias for 'hoox dev dashboard')
 *   deploy       Build and deploy the dashboard (alias for 'hoox deploy dashboard')
 *
 * For other dashboard operations:
 *   hoox deploy update-internal-urls  Update dashboard wrangler.jsonc with current service URLs
 */

import type { Command } from "commander";
import { withErrorHandling } from "../../utils/error-handler.js";

export function registerDashboardCommand(program: Command): void {
  const dashboardCmd = program
    .command("dashboard")
    .summary("Dashboard operations (dev, deploy)")
    .description(
      `Dashboard operations.

SUBCOMMANDS:
  dev          Start the dashboard dev server
  deploy       Build and deploy the dashboard

For updating internal service URLs in the dashboard config, use:
  hoox deploy update-internal-urls

EXAMPLES:
  hoox dashboard dev                      Start dashboard dev server
  hoox dashboard deploy                   Build and deploy the dashboard
  hoox dashboard deploy --rebuild         Force rebuild before deploy
`
    );

  // -- dashboard dev ------------------------------------------------------
  // Top-level alias for `hoox dev dashboard`

  dashboardCmd
    .command("dev")
    .description(
      "Start the dashboard dev server (alias for 'hoox dev dashboard')"
    )
    .action(
      withErrorHandling(
        async () => {
          const proc = Bun.spawn(["hoox", "dev", "dashboard"], {
            stdio: ["inherit", "inherit", "inherit"],
          });
          process.exitCode = await proc.exited;
        },
        { service: "dashboard" }
      )
    );

  // -- dashboard deploy ---------------------------------------------------
  // Top-level alias for `hoox deploy dashboard`

  dashboardCmd
    .command("deploy")
    .description(
      "Build and deploy the dashboard (alias for 'hoox deploy dashboard')"
    )
    .option("--rebuild", "Force rebuild before deploying")
    .option(
      "--auto",
      "Skip dashboard rebuild prompt, use existing build if available"
    )
    .action(
      withErrorHandling(
        async (options: { rebuild?: boolean; auto?: boolean }) => {
          const args = ["hoox", "deploy", "dashboard"];
          if (options.rebuild) args.push("--rebuild");
          if (options.auto) args.push("--auto");
          const proc = Bun.spawn(args, {
            stdio: ["inherit", "inherit", "inherit"],
          });
          process.exitCode = await proc.exited;
        },
        { service: "dashboard" }
      )
    );
}
