export class BunAdapter {
  async promptSecret(prompt: string): Promise<string> {
    return Bun.password(prompt);
  }

  async readFile(path: string): Promise<string> {
    return Bun.file(path).text();
  }

  async writeFile(path: string, content: string): Promise<void> {
    await Bun.write(path, content);
  }

  loadEnv(): Record<string, string> {
    return Bun.env as Record<string, string>;
  }
}
