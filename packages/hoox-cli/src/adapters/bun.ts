export class BunAdapter {
  async promptSecret(prompt: string): Promise<string> {
    // Use clack/prompts for password input
    const { password } = await import("@clack/prompts");
    const result = await password({ message: prompt });
    if (typeof result === "symbol") {
      throw new Error("Password input cancelled");
    }
    return result;
  }

  async readFile(path: string): Promise<string> {
    return Bun.file(path).text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    await Bun.write(path, content);
  }

  openSQLite(path: string): Bun.SQL {
    // Bun.sqlite was removed in newer versions, use Bun.SQL instead
    return new Bun.SQL(path);
  }

  loadEnv(): Record<string, string> {
    return Bun.env as Record<string, string>;
  }
}
