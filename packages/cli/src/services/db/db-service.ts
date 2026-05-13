import { ConfigService } from "../config/index.js";

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
}

export class DbService {
  private configService: ConfigService;

  constructor(configService?: ConfigService) {
    this.configService = configService ?? new ConfigService();
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
    schemaPath?: string,
  ): Promise<string> {
    const path = schemaPath ?? "workers/trade-worker/schema.sql";
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

  async query(
    dbName: string,
    sql: string,
    remote: boolean,
  ): Promise<string> {
    const args = ["d1", "execute", dbName, "--command", sql, "--json"];
    if (remote) args.push("--remote");
    return await this.runWrangler(args);
  }

  async export(
    dbName: string,
    outputPath?: string,
  ): Promise<string> {
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
          return first.results.map(
            (r: Record<string, unknown>) => String(r.name ?? ""),
          ).filter(Boolean);
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
      throw new Error(
        stderr.trim() || `wrangler exited with code ${exitCode}`,
      );
    }

    return stdout.trim();
  }

  private async readMigrationSql(): Promise<string> {
    try {
      const file = Bun.file("scripts/migrate-tracking.sh");
      if (await file.exists()) {
        const content = await file.text();
        const match = content.match(
          /d1\s+execute\s+\S+\s+--command=["'](.+?)["']/s,
        );
        if (match) return match[1];
      }
    } catch {
      // Fall through
    }
    return "SELECT 1";
  }
}
