export interface KvManifestKey {
  key: string;
  type: "boolean" | "number" | "string";
  default: string;
  description: string;
  secret?: boolean;
}

export interface KvManifest {
  namespace: string;
  keys: KvManifestKey[];
}

export class KvSyncService {
  async resolveNamespaceId(namespaceId?: string): Promise<string> {
    if (namespaceId) return namespaceId;

    try {
      const proc = Bun.spawn(["wrangler", "kv", "namespace", "list"], {
        stdout: "pipe",
        stderr: "pipe",
      });
      const stdout = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      if (exitCode === 0) {
        try {
          const namespaces = JSON.parse(stdout) as Array<{
            id: string;
            title: string;
          }>;
          const configKv = namespaces.find((n) => n.title === "CONFIG_KV");
          if (configKv) return configKv.id;
        } catch {
          // Not JSON — skip
        }
      }
    } catch {
      // wrangler not available
    }

    throw new Error(
      "Could not resolve CONFIG_KV namespace ID. Provide --namespace-id flag."
    );
  }

  async list(namespaceId: string): Promise<Array<{ name: string }>> {
    const proc = Bun.spawn(
      ["wrangler", "kv", "key", "list", "--namespace-id", namespaceId],
      { stdout: "pipe", stderr: "pipe" }
    );
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      throw new Error(
        `Failed to list KV keys: ${stdout.trim() || `exit ${exitCode}`}`
      );
    }

    try {
      const parsed = JSON.parse(stdout) as Array<{ name: string }>;
      return parsed;
    } catch {
      return stdout
        .split("\n")
        .filter(Boolean)
        .map((name) => ({ name: name.trim() }));
    }
  }

  async get(namespaceId: string, key: string): Promise<string | null> {
    const proc = Bun.spawn(
      ["wrangler", "kv", "key", "get", "--namespace-id", namespaceId, key],
      { stdout: "pipe", stderr: "pipe" }
    );
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      if (stderr.includes("not found")) return null;
      throw new Error(
        `Failed to get key "${key}": ${stderr.trim() || `exit ${exitCode}`}`
      );
    }

    return stdout.trim() || null;
  }

  async set(namespaceId: string, key: string, value: string): Promise<void> {
    const proc = Bun.spawn(
      ["wrangler", "kv", "key", "put", "--namespace-id", namespaceId, key],
      { stdout: "pipe", stderr: "pipe", stdin: "pipe" }
    );

    // Pipe the value through stdin — never via CLI args (avoids leaking
    // secrets via `ps`/process cmdline/shell history).
    proc.stdin.write(value + "\n");
    proc.stdin.end();

    const [, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      throw new Error(
        `Failed to set key "${key}": ${stderr.trim() || `exit ${exitCode}`}`
      );
    }
  }

  async delete(namespaceId: string, key: string): Promise<void> {
    const proc = Bun.spawn(
      ["wrangler", "kv", "key", "delete", "--namespace-id", namespaceId, key],
      { stdout: "pipe", stderr: "pipe" }
    );
    const exitCode = await proc.exited;
    const stderr = await new Response(proc.stderr).text();

    if (exitCode !== 0) {
      throw new Error(
        `Failed to delete key "${key}": ${stderr.trim() || `exit ${exitCode}`}`
      );
    }
  }

  static getManifest(): KvManifest {
    return {
      namespace: "CONFIG_KV",
      keys: [
        {
          key: "webhook:tradingview:ip_check_enabled",
          type: "boolean",
          default: "false",
          description: "Enable TradingView IP allowlist check",
        },
        {
          key: "webhook:allowed_ips",
          type: "string",
          default: "",
          description: "Comma-separated allowed IPs for webhook",
        },
        {
          key: "routing:dynamic:enabled",
          type: "boolean",
          default: "false",
          description: "Enable dynamic routing",
        },
        {
          key: "trade:max_daily_drawdown_percent",
          type: "number",
          default: "10",
          description: "Max daily loss percentage before halt",
        },
        {
          key: "trade:kill_switch",
          type: "boolean",
          default: "false",
          description: "Emergency stop all trading",
        },
        {
          key: "trade:watermark:{exchange}:{symbol}:{side}",
          type: "number",
          default: "",
          description: "Per-market watermark (template key)",
          secret: true,
        },
        {
          key: "agent:openai_key",
          type: "string",
          default: "",
          description: "OpenAI API key for AI agent",
          secret: true,
        },
        {
          key: "agent:anthropic_key",
          type: "string",
          default: "",
          description: "Anthropic API key for AI agent",
          secret: true,
        },
        {
          key: "agent:google_key",
          type: "string",
          default: "",
          description: "Google AI API key for agent",
          secret: true,
        },
        {
          key: "agent:azure_api_key",
          type: "string",
          default: "",
          description: "Azure OpenAI API key",
          secret: true,
        },
        {
          key: "agent:azure_endpoint",
          type: "string",
          default: "",
          description: "Azure OpenAI endpoint",
          secret: true,
        },
        {
          key: "email:scan_subject",
          type: "string",
          default: "",
          description: "Email subject filter for signal scanning",
        },
        {
          key: "email:coin_pattern",
          type: "string",
          default: "",
          description: "Regex pattern to extract coin from email",
        },
        {
          key: "email:action_pattern",
          type: "string",
          default: "",
          description: "Regex pattern to extract action from email",
        },
        {
          key: "email:quantity_multiplier",
          type: "number",
          default: "1",
          description: "Multiplier for email signal quantity",
        },
        {
          key: "email:use_imap",
          type: "boolean",
          default: "false",
          description: "Use IMAP for email scanning",
        },
      ],
    };
  }

  static getManifestKeys(): KvManifestKey[] {
    return KvSyncService.getManifest().keys;
  }
}
