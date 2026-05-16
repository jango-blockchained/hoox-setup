import { Command } from "commander";
import { UpdateService } from "../../services/update/index.js";
import {
  formatSuccess,
  formatError,
  getFormatOptions,
} from "../../utils/formatters.js";
import { CLIError, ExitCode } from "../../utils/errors.js";

export function registerUpdateCommand(program: Command): void {
  program
    .command("update")
    .summary("Update project dependencies (default: wrangler)")
    .description(
      `Update wrangler to the latest available version.

Updates wrangler in the project's package.json
via \`bun update wrangler\`.

EXAMPLES:
  hoox update              Check and update wrangler`
    )
    .action(async () => {
      const fmt = getFormatOptions(program);
      try {
        const service = new UpdateService();
        const result = await service.updateWrangler();

        if (result.updated) {
          formatSuccess(
            result.newVersion
              ? `Wrangler updated to ${result.newVersion}`
              : "Wrangler updated",
            fmt
          );
        } else if (result.error) {
          formatError(
            new CLIError(`Update failed: ${result.error}`, ExitCode.ERROR),
            fmt
          );
          process.exitCode = ExitCode.ERROR;
        } else {
          formatSuccess("Wrangler is already up to date", fmt);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        formatError(message, fmt);
        process.exitCode = ExitCode.ERROR;
      }
    });
}
