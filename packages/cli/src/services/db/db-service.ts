import { join } from "node:path";
import { ConfigService } from "../config/index.js";

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export class DbService {
  private configService: ConfigService;
  private readonly homeDir: string | undefined;

  constructor(configService?: ConfigService, homeDir?: string) {
    this.configService = configService ?? new ConfigService();
    this.homeDir = homeDir;
  }

  /**
   * Resolve the default schema path using home directory when available.
   *
   * When `homeDir` is configured, resolves to `$HOME/.hoox/workers/trade-worker/schema.sql`.
   * Falls back to the default relative path `workers/trade-worker/schema.sql`.
   */
  private resolveDefaultSchemaPath(): string {
    if (this.homeDir) {
      return join(
        this.homeDir,
        ".hoox",
        "workers",
        "trade-worker",
        "schema.sql"
      );
    }
    return "workers/trade-worker/schema.sql";
  }

  /**
   * Resolve the migration script path using home directory when available.
   *
   * When `homeDir` is configured, resolves to `$HOME/.hoox/scripts/migrate-tracking.sh`.
   * Falls back to `scripts/migrate-tracking.sh` relative to cwd.
   */
  private resolveMigrationScriptPath(): string {
    if (this.homeDir) {
      return join(this.homeDir, ".hoox", "scripts", "migrate-tracking.sh");
    }
    return "scripts/migrate-tracking.sh";
  }

  async resolveDbName(dbName?: string): Promise<string> {
    if (dbName) return dbName;
    try {
      await this.configService.load();
      const d1Worker = this.configService.getWorker("d1-worker");
      const vars = d1Worker?.vars as Record<string, string> | undefined;
      if (vars?.database_name) return vars.database_name;
    } catch {
      // Config not found — use default
    }
    return "my-database";
  }

  async apply(
    dbName: string,
    remote: boolean,
    schemaPath?: string
  ): Promise<string> {
    const path = schemaPath ?? this.resolveDefaultSchemaPath();
    const args = ["d1", "execute", dbName, "--file", path];
    if (remote) args.push("--remote");
    return await this.runWrangler(args);
  }

  async migrate(dbName: string, remote: boolean): Promise<string> {
    const migrationSql = await this.readMigrationSql();
    const args = ["d1", "execute", dbName, "--command", migrationSql];
    if (remote) args.push("--remote");
    return await this.runWrangler(args);
  }

  async listTables(dbName: string, remote: boolean): Promise<string[]> {
    const args = [
      "d1",
      "execute",
      dbName,
      "--command",
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      "--json",
    ];
    if (remote) args.push("--remote");

    const output = await this.runWrangler(args);
    return DbService.parseTableNames(output);
  }

  async query(dbName: string, sql: string, remote: boolean): Promise<string> {
    const args = ["d1", "execute", dbName, "--command", sql, "--json"];
    if (remote) args.push("--remote");
    return await this.runWrangler(args);
  }

  async export(dbName: string, outputPath?: string): Promise<string> {
    const outPath =
      outputPath ?? `backup-${new Date().toISOString().slice(0, 10)}.sql`;
    const args = ["d1", "export", dbName, "--output", outPath, "--remote"];
    await this.runWrangler(args);
    return outPath;
  }

  async reset(dbName: string): Promise<string> {
    await this.runWrangler(["d1", "delete", dbName, "-y"]);
    return await this.runWrangler(["d1", "create", dbName]);
  }

  static parseTableNames(output: string): string[] {
    try {
      const parsed = JSON.parse(output);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const first = parsed[0];
        if (first.results && Array.isArray(first.results)) {
          return first.results
            .map((r: Record<string, unknown>) => String(r.name ?? ""))
            .filter(Boolean);
        }
      }
    } catch {
      // Not JSON — try text parse
    }
    return output
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  private async runWrangler(args: string[]): Promise<string> {
    const proc = Bun.spawn(["wrangler", ...args], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      throw new Error(stderr.trim() || `wrangler exited with code ${exitCode}`);
    }

    return stdout.trim();
  }

  private async readMigrationSql(): Promise<string> {
    const path = this.resolveMigrationScriptPath();
    let file: ReturnType<typeof Bun.file>;
    try {
      file = Bun.file(path);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      throw new Error(
        `Migration script "${path}" could not be read: ${message}. ` +
          `Refusing to run no-op migration.`,
        { cause: e }
      );
    }
    if (!(await file.exists())) {
      throw new Error(
        `Migration script "${path}" not found. ` +
          `Refusing to run no-op migration. Create the script or run \`hoox setup\` first.`
      );
    }
    const content = await file.text();
    const match = content.match(
      /d1\s+execute\s+\S+\s+--command=["'](.+?)["']/s
    );
    if (!match) {
      throw new Error(
        `Migration script "${path}" was found but no \`d1 execute … --command="…"\` line could be extracted. ` +
          `Refusing to fall back to a no-op migration — please check the script format.`
      );
    }
    return match[1];
  }
}
