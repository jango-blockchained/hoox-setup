import { Command } from "commander";
import { spinner } from "@clack/prompts";
import { ConfigService } from "../../services/config/index.js";
import { UpdateService } from "../../services/update/index.js";
import { CLIError, ExitCode } from "../../utils/errors.js";
import { withErrorHandling } from "../../utils/error-handler.js";
import { theme } from "../../utils/theme.js";
import {
  gitPull,
  gitSubmoduleUpdate,
  isGitRepo,
  isSubmodule,
} from "../../utils/git.js";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .summary("Sync repo from GitHub or update wrangler")
    .description(
      `Update your local project from GitHub or update wrangler.

Without arguments, pulls latest changes for the main repo.
With a worker name, updates that worker's submodule from its remote.
With "wrangler", updates wrangler to the latest version.

EXAMPLES:
  hoox update              Pull latest for main repo
  hoox update d1-worker    Update the d1-worker submodule
  hoox update wrangler     Update wrangler to latest version`
    )
    .argument(
      "[target]",
      'What to update: worker name (e.g. d1-worker) or "wrangler"'
    )
    .action(
      withErrorHandling(
        async (target?: string) => {
          const cwd = process.cwd();

          if (target === "wrangler") {
            const service = new UpdateService();
            const result = await service.updateWrangler();

            if (result.error) {
              throw new CLIError(
                `Update failed: ${result.error}`,
                ExitCode.ERROR
              );
            }
            return;
          }

          if (!(await isGitRepo(cwd))) {
            throw new CLIError(
              "Not a git repository — run this command from the project root",
              ExitCode.INVALID_USAGE
            );
          }

          if (target) {
            const configService = new ConfigService();
            await configService.load();
            const worker = configService.getWorker(target);

            if (!worker) {
              throw new CLIError(
                `Unknown worker "${target}" — not found in wrangler.jsonc`,
                ExitCode.INVALID_USAGE
              );
            }

            const submodulePath = worker.path;
            if (!(await isSubmodule(cwd, submodulePath))) {
              throw new CLIError(
                `"${submodulePath}" is not a git submodule — nothing to update`,
                ExitCode.INVALID_USAGE
              );
            }

            const s = spinner();
            s.start(`Updating ${target}...`);

            const output = await gitSubmoduleUpdate(cwd, submodulePath);

            s.stop(
              output
                ? theme.success(`Updated ${target}`)
                : theme.muted(`${target} already up to date`)
            );
          } else {
            const s = spinner();
            s.start("Pulling latest from remote...");

            const output = await gitPull(cwd);

            s.stop(
              output
                ? theme.success("Repository up to date")
                : theme.muted("Already up to date")
            );
          }
        },
        { service: "update" }
      )
    );
}
