import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

export default class CfSecretsCommand implements Command {
  name = "cf:secrets";
  description = "Manage Cloudflare secrets";

  async execute(ctx: CommandContext): Promise<void> {
    p.intro("Cloudflare Secrets Management");

    ctx.observer.emit("command:start", { cmd: this.name });

    try {
      const action = await p.select({
        message: "What would you like to do?",
        options: [
          { value: "list", label: "List secrets" },
          { value: "get", label: "Get secret metadata" },
          { value: "set", label: "Set a secret" },
          { value: "delete", label: "Delete a secret" },
        ],
      });

      if (p.isCancel(action)) {
        p.cancel("Operation cancelled.");
        return;
      }

      if (action === "list") {
        await this.listSecrets(ctx);
      } else if (action === "get") {
        await this.getSecret(ctx);
      } else if (action === "set") {
        await this.setSecret(ctx);
      } else if (action === "delete") {
        await this.deleteSecret(ctx);
      }

      ctx.observer.setState({ commandStatus: "success" });
      p.outro("Secrets operation completed successfully!");
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Secrets operation failed: ${error instanceof Error ? error.message : String(error)}`,
              "SECRETS_ERROR",
              false
            );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  private async listSecrets(ctx: CommandContext): Promise<void> {
    const config = await this.getConfig(ctx);
    if (!config) return;

    const spinner = p.spinner();
    spinner.start("Fetching secrets...");

    try {
      const secrets = await ctx.adapters.cloudflare.listSecrets(
        config.secretStoreId
      );

      spinner.stop("Secrets retrieved!");

      if (secrets.length === 0) {
        p.log.info("No secrets found.");
        return;
      }

      p.log.step("Secrets:");
      secrets.forEach((s) => {
        p.log.message(`${s.name} - v${s.version} (${s.created})`);
      });
    } catch (error) {
      spinner.stop("Failed to fetch secrets.", 1);
      throw error;
    }
  }

  private async getSecret(ctx: CommandContext): Promise<void> {
    const config = await this.getConfig(ctx);
    if (!config) return;

    const name = await p.text({
      message: "Enter secret name:",
      validate: (v) => (!v ? "Secret name is required" : undefined),
    });

    if (p.isCancel(name)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spinner = p.spinner();
    spinner.start("Fetching secret metadata...");

    try {
      const secret = await ctx.adapters.cloudflare.getSecret(
        config.secretStoreId,
        name
      );

      spinner.stop("Secret metadata retrieved!");

      p.log.step("Secret Details:");
      p.log.message(`Name: ${secret.name}`);
      p.log.message(`Created: ${secret.created}`);
      p.log.message(`Version: ${secret.version}`);
      if (secret.expires_on) {
        p.log.message(`Expires: ${secret.expires_on}`);
      }
    } catch (error) {
      spinner.stop("Failed to fetch secret.", 1);
      throw error;
    }
  }

  private async setSecret(ctx: CommandContext): Promise<void> {
    const config = await this.getConfig(ctx);
    if (!config) return;

    const name = await p.text({
      message: "Enter secret name:",
      validate: (v) => (!v ? "Secret name is required" : undefined),
    });

    if (p.isCancel(name)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const value = await p.text({
      message: "Enter secret value:",
      validate: (v) => (!v ? "Secret value is required" : undefined),
    });

    if (p.isCancel(value)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const confirmed = await p.confirm({
      message: `Set secret "${name}"?`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spinner = p.spinner();
    spinner.start("Setting secret...");

    try {
      await ctx.adapters.cloudflare.setSecret(
        config.secretStoreId,
        name,
        value
      );
      spinner.stop(`Secret "${name}" set successfully!`);
    } catch (error) {
      spinner.stop("Failed to set secret.", 1);
      throw error;
    }
  }

  private async deleteSecret(ctx: CommandContext): Promise<void> {
    const config = await this.getConfig(ctx);
    if (!config) return;

    const name = await p.text({
      message: "Enter secret name to delete:",
      validate: (v) => (!v ? "Secret name is required" : undefined),
    });

    if (p.isCancel(name)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const confirmed = await p.confirm({
      message: `Are you sure you want to delete secret "${name}"? This action cannot be undone.`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spinner = p.spinner();
    spinner.start("Deleting secret...");

    try {
      await ctx.adapters.cloudflare.deleteSecret(config.secretStoreId, name);
      spinner.stop(`Secret "${name}" deleted successfully!`);
    } catch (error) {
      spinner.stop("Failed to delete secret.", 1);
      throw error;
    }
  }

  private async getConfig(
    ctx: CommandContext
  ): Promise<{ secretStoreId: string } | null> {
    // This is a simplified version - in reality, we'd get this from ctx or config
    const secretStoreId = "test-store-id"; // Placeholder
    if (!secretStoreId) {
      p.log.error("No secret store ID configured.");
      return null;
    }
    return { secretStoreId };
  }
}
