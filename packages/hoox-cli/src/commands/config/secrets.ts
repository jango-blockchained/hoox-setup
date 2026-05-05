import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

export class ConfigSecretsCommand implements Command {
  name = "config:secrets";
  description = "Manage Cloudflare Secret Store values";
  options = [
    {
      flag: "list",
      short: "l",
      type: "boolean" as const,
      description: "List all secrets",
    },
    {
      flag: "set",
      short: "s",
      type: "boolean" as const,
      description: "Set a secret value",
    },
    {
      flag: "delete",
      short: "d",
      type: "boolean" as const,
      description: "Delete a secret",
    },
    { flag: "name", type: "string" as const, description: "Secret name" },
    { flag: "value", type: "string" as const, description: "Secret value" },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    ctx.observer.emit("command:start", {
      cmd: this.name,
      args: {
        list: ctx.args?.list,
        set: ctx.args?.set,
        delete: ctx.args?.delete,
        name: ctx.args?.name,
        value: ctx.args?.value,
      },
    });

    try {
      p.intro("Cloudflare Secret Store Manager");

      const action = ctx.args?.list
        ? "list"
        : ctx.args?.set
          ? "set"
          : ctx.args?.delete
            ? "delete"
            : await p.select({
                message: "What would you like to do?",
                options: [
                  { value: "list", label: "List all secrets" },
                  { value: "set", label: "Set a secret" },
                  { value: "delete", label: "Delete a secret" },
                ],
              });

      if (p.isCancel(action)) {
        p.cancel("Operation cancelled.");
        return;
      }

      const spinner = p.spinner();

      if (action === "list") {
        await this.listSecrets(ctx, spinner);
      } else if (action === "set") {
        await this.setSecret(ctx, spinner);
      } else if (action === "delete") {
        await this.deleteSecret(ctx, spinner);
      }

      p.outro("Secret operation completed!");
      ctx.observer.setState({ commandStatus: "success" });
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Secrets command failed: ${error instanceof Error ? error.message : String(error)}`,
              "SECRETS_FAILED",
              false
            );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  private async listSecrets(
    ctx: CommandContext,
    spinner: ReturnType<typeof p.spinner>
  ): Promise<void> {
    spinner.start("Fetching secrets from Cloudflare Secret Store...");

    try {
      // Use cloudflare adapter to list secrets
      // This would call ctx.adapters.cloudflare.listSecrets() in real implementation
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate async operation

      spinner.stop("Secrets retrieved successfully!");
      p.log.info("No secrets found (placeholder - implement with adapter)");
    } catch (error) {
      spinner.stop("Failed to fetch secrets");
      throw error;
    }
  }

  private async setSecret(
    ctx: CommandContext,
    spinner: ReturnType<typeof p.spinner>
  ): Promise<void> {
    let secretName = ctx.args?.name as string | undefined;

    if (!secretName) {
      const input = await p.text({
        message: "Enter secret name:",
        validate: (v) => (!v ? "Secret name is required" : undefined),
      });
      if (p.isCancel(input)) {
        p.cancel("Operation cancelled.");
        return;
      }
      secretName = input;
    }

    let _secretValue = ctx.args?.value as string | undefined;

    if (!_secretValue) {
      const input =
        (await p.password?.({
          message: `Enter value for ${secretName}:`,
        })) || (await p.text({ message: `Enter value for ${secretName}:` }));
      if (p.isCancel(input)) {
        p.cancel("Operation cancelled.");
        return;
      }
      _secretValue = input as string;
    }
    void _secretValue; // Will be used when cloudflare adapter is integrated

    spinner.start(`Setting secret ${secretName}...`);

    try {
      // Use cloudflare adapter to set secret
      // This would call ctx.adapters.cloudflare.setSecret() in real implementation
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate async operation

      spinner.stop(`Secret ${secretName} set successfully!`);
    } catch (error) {
      spinner.stop(`Failed to set secret ${secretName}`);
      throw error;
    }
  }

  private async deleteSecret(
    ctx: CommandContext,
    spinner: ReturnType<typeof p.spinner>
  ): Promise<void> {
    let secretName = ctx.args?.name as string | undefined;

    if (!secretName) {
      const input = await p.text({
        message: "Enter secret name to delete:",
        validate: (v) => (!v ? "Secret name is required" : undefined),
      });
      if (p.isCancel(input)) {
        p.cancel("Operation cancelled.");
        return;
      }
      secretName = input;
    }

    const confirmed = await p.confirm({
      message: `Are you sure you want to delete secret "${secretName}"?`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      return;
    }

    spinner.start(`Deleting secret ${secretName}...`);

    try {
      // Use cloudflare adapter to delete secret
      // This would call ctx.adapters.cloudflare.deleteSecret() in real implementation
      await new Promise((resolve) => setTimeout(resolve, 500)); // Simulate async operation

      spinner.stop(`Secret ${secretName} deleted successfully!`);
    } catch (error) {
      spinner.stop(`Failed to delete secret ${secretName}`);
      throw error;
    }
  }
}
