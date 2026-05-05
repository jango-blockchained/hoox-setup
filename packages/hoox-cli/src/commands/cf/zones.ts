import * as p from "@clack/prompts";
import type { Command, CommandContext } from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

export default class CfZonesCommand implements Command {
  name = "cf:zones";
  description = "Manage Cloudflare zones and DNS records";

  async execute(ctx: CommandContext): Promise<void> {
    p.intro("Cloudflare Zones Management");

    ctx.observer.emit("command:start", { cmd: this.name });

    try {
      const action = await p.select({
        message: "What would you like to do?",
        options: [
          { value: "list", label: "List zones" },
          { value: "dns", label: "List DNS records for a zone" },
          { value: "add-dns", label: "Add a DNS record" },
        ],
      });

      if (p.isCancel(action)) {
        p.cancel("Operation cancelled.");
        return;
      }

      if (action === "list") {
        await this.listZones(ctx);
      } else if (action === "dns") {
        await this.listDNSRecords(ctx);
      } else if (action === "add-dns") {
        await this.addDNSRecord(ctx);
      }

      ctx.observer.setState({ commandStatus: "success" });
      p.outro("Zones operation completed successfully!");
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `Zones operation failed: ${error instanceof Error ? error.message : String(error)}`,
              "ZONES_ERROR",
              false
            );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  private async listZones(ctx: CommandContext): Promise<void> {
    const spinner = p.spinner();
    spinner.start("Fetching zones...");

    try {
      const zones = await ctx.adapters.cloudflare.listZones();

      spinner.stop("Zones retrieved!");

      if (zones.length === 0) {
        p.log.info("No zones found.");
        return;
      }

      p.log.step("Zones:");
      zones.forEach((z) => {
        p.log.message(`${z.name} [${z.status}]`);
      });
    } catch (error) {
      spinner.stop("Failed to fetch zones.");
      throw error;
    }
  }

  private async listDNSRecords(ctx: CommandContext): Promise<void> {
    const zones = await ctx.adapters.cloudflare.listZones();

    if (zones.length === 0) {
      p.log.info("No zones found.");
      return;
    }

    const zoneId = await p.select({
      message: "Select zone:",
      options: zones.map((z) => ({
        value: z.id,
        label: z.name,
      })),
    });

    if (p.isCancel(zoneId)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spinner = p.spinner();
    spinner.start("Fetching DNS records...");

    try {
      const records = await ctx.adapters.cloudflare.listDNSRecords(zoneId);

      spinner.stop("DNS records retrieved!");

      if (records.length === 0) {
        p.log.info("No DNS records found.");
        return;
      }

      p.log.step("DNS Records:");
      records.forEach((r) => {
        p.log.message(`${r.type} ${r.name} -> ${r.content}`);
      });
    } catch (error) {
      spinner.stop("Failed to fetch DNS records.");
      throw error;
    }
  }

  private async addDNSRecord(ctx: CommandContext): Promise<void> {
    const zones = await ctx.adapters.cloudflare.listZones();

    if (zones.length === 0) {
      p.log.info("No zones found.");
      return;
    }

    const zoneId = await p.select({
      message: "Select zone:",
      options: zones.map((z) => ({
        value: z.id,
        label: z.name,
      })),
    });

    if (p.isCancel(zoneId)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const type = await p.select({
      message: "Select record type:",
      options: [
        { value: "A", label: "A - IPv4 address" },
        { value: "AAAA", label: "AAAA - IPv6 address" },
        { value: "CNAME", label: "CNAME - Canonical name" },
        { value: "TXT", label: "TXT - Text record" },
        { value: "MX", label: "MX - Mail exchange" },
      ],
    });

    if (p.isCancel(type)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const name = await p.text({
      message: "Enter record name (e.g., @ for root):",
      validate: (v) => (!v ? "Record name is required" : undefined),
    });

    if (p.isCancel(name)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const content = await p.text({
      message: "Enter record content:",
      validate: (v) => (!v ? "Content is required" : undefined),
    });

    if (p.isCancel(content)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const confirmed = await p.confirm({
      message: `Add ${type} record "${name}" -> "${content}"?`,
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      return;
    }

    const spinner = p.spinner();
    spinner.start("Adding DNS record...");

    try {
      await ctx.adapters.cloudflare.addDNSRecord(zoneId, {
        type,
        name,
        content,
      });
      spinner.stop("DNS record added successfully!");
    } catch (error) {
      spinner.stop("Failed to add DNS record.");
      throw error;
    }
  }
}
