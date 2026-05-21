/**
 * `hoox disclaimer` command — displays legal disclaimers and trademark information.
 *
 * Uses the centralized legal notices from @jango-blockchained/hoox-shared/legal
 * so all surfaces (CLI, HTTP, Dashboard) stay consistent.
 */

import type { Command } from "commander";
import { FULL_LEGAL_NOTICE } from "@jango-blockchained/hoox-shared/legal";

/**
 * Registers the `hoox disclaimer` command on the given Commander.js program instance.
 */
export function registerDisclaimerCommand(program: Command): void {
  program
    .command("disclaimer")
    .description("Display legal disclaimers and trademark information")
    .action(() => {
      console.log(FULL_LEGAL_NOTICE);
    });
}
