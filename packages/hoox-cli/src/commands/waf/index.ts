import * as p from "@clack/prompts";
import ansis from "ansis";
import type {
  Command,
  CommandContext,
  CommandOption,
} from "../../core/types.js";
import { CLIError } from "../../core/errors.js";

/** WAF enforcement mode. */
type WAFMode = "block" | "challenge" | "simulate";

/** WAF rules stored in KV as JSON. */
interface WAFRules {
  mode: WAFMode;
  allowedIPs: string[];
  rateLimiting: {
    requestsPerMinute: number;
    burstSize: number;
  };
}

const KV_NAMESPACE_TITLE = "CONFIG_KV";
const KV_KEY = "waf_rules";

const VALID_MODES: WAFMode[] = ["block", "challenge", "simulate"];

/** IPv4 with optional CIDR suffix. */
const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
/** IPv6 with optional CIDR suffix. */
const IPV6_RE = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(\/\d{1,3})?$/;

const DEFAULT_RULES: WAFRules = {
  mode: "block",
  allowedIPs: [],
  rateLimiting: { requestsPerMinute: 100, burstSize: 20 },
};

export default class WafCommand implements Command {
  name = "waf";
  description = "Configure WAF rules (IP allowlist and rate limiting)";
  options: CommandOption[] = [
    {
      flag: "ips",
      short: "i",
      type: "string",
      description:
        "Comma-separated list of allowed IPs (CIDR notation supported)",
    },
    {
      flag: "mode",
      short: "m",
      type: "string",
      description: "WAF mode: block, challenge, or simulate",
    },
  ];

  async execute(ctx: CommandContext): Promise<void> {
    p.intro("WAF Configuration");
    ctx.observer.emit("command:start", { cmd: this.name });

    try {
      const ipsArg = ctx.args?.ips as string | undefined;
      const modeArg = ctx.args?.mode as string | undefined;

      // Validate mode if provided
      if (modeArg && !VALID_MODES.includes(modeArg as WAFMode)) {
        throw new CLIError(
          `Invalid mode "${modeArg}". Must be: block, challenge, or simulate`,
          "WAF_INVALID_MODE"
        );
      }

      // Validate IPs if provided
      if (ipsArg) {
        const ips = ipsArg
          .split(",")
          .map((ip) => ip.trim())
          .filter(Boolean);
        const invalidIPs = ips.filter((ip) => !this.isValidIP(ip));
        if (invalidIPs.length > 0) {
          throw new CLIError(
            `Invalid IP format: ${invalidIPs.join(", ")}`,
            "WAF_INVALID_IP"
          );
        }
      }

      // If flags provided, apply directly
      if (ipsArg || modeArg) {
        await this.applyFlags(ctx, {
          ips: ipsArg,
          mode: modeArg as WAFMode | undefined,
        });
      } else {
        // Interactive mode
        await this.interactiveFlow(ctx);
      }

      ctx.observer.setState({ commandStatus: "success" });
      p.outro("WAF configuration complete!");
    } catch (error) {
      const cliError =
        error instanceof CLIError
          ? error
          : new CLIError(
              `WAF configuration failed: ${error instanceof Error ? error.message : String(error)}`,
              "WAF_ERROR",
              false
            );
      p.log.error(cliError.message);
      ctx.observer.setState({ commandStatus: "error", lastError: cliError });
    }
  }

  /** Validate an IP address (v4 or v6, with optional CIDR). */
  private isValidIP(ip: string): boolean {
    return IPV4_RE.test(ip) || IPV6_RE.test(ip);
  }

  /** Resolve the CONFIG_KV namespace ID from its title. */
  private async resolveNamespaceId(ctx: CommandContext): Promise<string> {
    const namespaces = await ctx.adapters.cloudflare.listKVNamespaces();
    const ns = namespaces.find((n) => n.title === KV_NAMESPACE_TITLE);
    if (!ns) {
      throw new CLIError(
        `KV namespace "${KV_NAMESPACE_TITLE}" not found. Create it first with \`hoox cf:kv\`.`,
        "WAF_NAMESPACE_NOT_FOUND"
      );
    }
    return ns.id;
  }

  /** Load current WAF rules from KV. */
  private async loadRules(ctx: CommandContext): Promise<WAFRules> {
    const namespaceId = await this.resolveNamespaceId(ctx);
    const raw = await ctx.adapters.cloudflare.getKVValue(namespaceId, KV_KEY);
    if (!raw) return { ...DEFAULT_RULES };
    try {
      return JSON.parse(raw) as WAFRules;
    } catch {
      p.log.warn("Stored WAF rules are malformed; resetting to defaults.");
      return { ...DEFAULT_RULES };
    }
  }

  /** Persist WAF rules to KV. */
  private async saveRules(ctx: CommandContext, rules: WAFRules): Promise<void> {
    const namespaceId = await this.resolveNamespaceId(ctx);
    const spinner = p.spinner();
    spinner.start("Saving WAF rules to KV...");
    try {
      await ctx.adapters.cloudflare.putKVValue(
        namespaceId,
        KV_KEY,
        JSON.stringify(rules, null, 2)
      );
      spinner.stop("WAF rules saved!");
    } catch (error) {
      spinner.stop("Failed to save WAF rules.");
      throw error;
    }
  }

  /** Display current WAF rules. */
  private showRules(rules: WAFRules): void {
    p.log.step("Current WAF Rules:");
    p.log.message(ansis.bold("  Mode: ") + ansis.cyan(rules.mode));

    if (rules.allowedIPs.length > 0) {
      p.log.message(ansis.bold("  Allowed IPs:"));
      for (const ip of rules.allowedIPs) {
        p.log.message(ansis.green(`    ✓ ${ip}`));
      }
    } else {
      p.log.message(ansis.dim("  Allowed IPs: (none)"));
    }

    p.log.message(
      ansis.bold("  Rate Limiting: ") +
        ansis.dim(
          `${rules.rateLimiting.requestsPerMinute} req/min, burst ${rules.rateLimiting.burstSize}`
        )
    );
  }

  /** Apply --ips and --mode flags directly. */
  private async applyFlags(
    ctx: CommandContext,
    flags: { ips?: string; mode?: WAFMode }
  ): Promise<void> {
    const rules = await this.loadRules(ctx);

    if (flags.mode) {
      rules.mode = flags.mode;
      p.log.success(`Mode set to ${ansis.cyan(flags.mode)}`);
    }

    if (flags.ips) {
      const ips = flags.ips
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean);
      rules.allowedIPs = ips;
      p.log.success(`IP allowlist updated: ${ansis.green(ips.join(", "))}`);
    }

    await this.saveRules(ctx, rules);
    this.showRules(rules);
  }

  /** Interactive configuration flow. */
  private async interactiveFlow(ctx: CommandContext): Promise<void> {
    const rules = await this.loadRules(ctx);
    this.showRules(rules);

    const action = await p.select({
      message: "What would you like to configure?",
      options: [
        { value: "ips", label: "Manage IP allowlist" },
        { value: "mode", label: "Change enforcement mode" },
        { value: "rateLimit", label: "Configure rate limiting" },
        { value: "view", label: "View current rules" },
        { value: "reset", label: "Reset to defaults" },
      ],
    });

    if (p.isCancel(action)) {
      p.cancel("Operation cancelled.");
      return;
    }

    switch (action) {
      case "ips":
        await this.configureIPs(ctx, rules);
        break;
      case "mode":
        await this.configureMode(ctx, rules);
        break;
      case "rateLimit":
        await this.configureRateLimit(ctx, rules);
        break;
      case "view":
        this.showRules(rules);
        break;
      case "reset":
        await this.resetRules(ctx);
        break;
    }
  }

  /** Interactive IP allowlist configuration. */
  private async configureIPs(
    ctx: CommandContext,
    rules: WAFRules
  ): Promise<void> {
    const ipAction = await p.select({
      message: "IP allowlist action:",
      options: [
        { value: "add", label: "Add IPs" },
        { value: "remove", label: "Remove IPs" },
        { value: "set", label: "Replace allowlist" },
      ],
    });

    if (p.isCancel(ipAction)) {
      p.cancel("Operation cancelled.");
      return;
    }

    if (ipAction === "add" || ipAction === "set") {
      const input = await p.text({
        message:
          ipAction === "add"
            ? "Enter IPs to add (comma-separated):"
            : "Enter new allowlist (comma-separated):",
        validate: (v) => {
          if (!v?.trim()) return "At least one IP is required";
          const ips = v
            .split(",")
            .map((ip) => ip.trim())
            .filter(Boolean);
          const invalid = ips.filter((ip) => !this.isValidIP(ip));
          if (invalid.length > 0)
            return `Invalid IP format: ${invalid.join(", ")}`;
          return undefined;
        },
      });

      if (p.isCancel(input)) {
        p.cancel("Operation cancelled.");
        return;
      }

      const newIPs = (input as string)
        .split(",")
        .map((ip) => ip.trim())
        .filter(Boolean);

      if (ipAction === "add") {
        const existing = new Set(rules.allowedIPs);
        for (const ip of newIPs) {
          if (!existing.has(ip)) {
            rules.allowedIPs.push(ip);
          }
        }
        p.log.success(`Added ${newIPs.length} IP(s) to allowlist.`);
      } else {
        rules.allowedIPs = newIPs;
        p.log.success(`Allowlist replaced with ${newIPs.length} IP(s).`);
      }
    } else if (ipAction === "remove") {
      if (rules.allowedIPs.length === 0) {
        p.log.info("No IPs in allowlist to remove.");
        return;
      }

      const toRemove = await p.select({
        message: "Select IP to remove:",
        options: rules.allowedIPs.map((ip) => ({ value: ip, label: ip })),
      });

      if (p.isCancel(toRemove)) {
        p.cancel("Operation cancelled.");
        return;
      }

      rules.allowedIPs = rules.allowedIPs.filter((ip) => ip !== toRemove);
      p.log.success(`Removed ${ansis.red(toRemove as string)} from allowlist.`);
    }

    await this.saveRules(ctx, rules);
    this.showRules(rules);
  }

  /** Interactive mode configuration. */
  private async configureMode(
    ctx: CommandContext,
    rules: WAFRules
  ): Promise<void> {
    const mode = await p.select({
      message: "Select enforcement mode:",
      options: [
        {
          value: "block",
          label: "Block — deny requests from non-allowlisted IPs",
          hint: "strict",
        },
        {
          value: "challenge",
          label: "Challenge — show challenge page",
          hint: "moderate",
        },
        {
          value: "simulate",
          label: "Simulate — log only, no enforcement",
          hint: "permissive",
        },
      ],
    });

    if (p.isCancel(mode)) {
      p.cancel("Operation cancelled.");
      return;
    }

    rules.mode = mode as WAFMode;
    await this.saveRules(ctx, rules);
    p.log.success(`Mode set to ${ansis.cyan(rules.mode)}`);
    this.showRules(rules);
  }

  /** Interactive rate limiting configuration. */
  private async configureRateLimit(
    ctx: CommandContext,
    rules: WAFRules
  ): Promise<void> {
    const rpmInput = await p.text({
      message: "Requests per minute:",
      initialValue: String(rules.rateLimiting.requestsPerMinute),
      validate: (v) => {
        const n = Number(v ?? "0");
        if (isNaN(n) || n < 1 || !Number.isInteger(n))
          return "Must be a positive integer";
        return undefined;
      },
    });

    if (p.isCancel(rpmInput)) {
      p.cancel("Operation cancelled.");
      return;
    }

    const burstInput = await p.text({
      message: "Burst size:",
      initialValue: String(rules.rateLimiting.burstSize),
      validate: (v) => {
        const n = Number(v ?? "0");
        if (isNaN(n) || n < 1 || !Number.isInteger(n))
          return "Must be a positive integer";
        return undefined;
      },
    });

    if (p.isCancel(burstInput)) {
      p.cancel("Operation cancelled.");
      return;
    }

    rules.rateLimiting = {
      requestsPerMinute: Number(rpmInput),
      burstSize: Number(burstInput),
    };

    await this.saveRules(ctx, rules);
    p.log.success("Rate limiting updated.");
    this.showRules(rules);
  }

  /** Reset WAF rules to defaults. */
  private async resetRules(ctx: CommandContext): Promise<void> {
    const confirmed = await p.confirm({
      message: "Reset all WAF rules to defaults?",
      initialValue: false,
    });

    if (p.isCancel(confirmed) || !confirmed) {
      p.cancel("Operation cancelled.");
      return;
    }

    const defaults: WAFRules = {
      ...DEFAULT_RULES,
      allowedIPs: [],
      rateLimiting: { ...DEFAULT_RULES.rateLimiting },
    };
    await this.saveRules(ctx, defaults);
    p.log.success("WAF rules reset to defaults.");
    this.showRules(defaults);
  }
}
