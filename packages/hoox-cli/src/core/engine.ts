import type { Engine, CommandContext, AppState, Observer } from "./types.js";

export class AppEngine implements Engine {
  private observer: Observer;
  private adapters: CommandContext["adapters"];
  private unsubs: (() => void)[] = [];

  constructor(observer: Observer, adapters: CommandContext["adapters"]) {
    this.observer = observer;
    this.adapters = adapters;
  }

  async initialize(): Promise<void> {
    const connected = await this.adapters.cloudflare.testConnection();
    if (!connected) {
      throw new Error("Failed to connect to Cloudflare");
    }
  }

  startListening(): void {
    const unsub1 = this.observer.on("command:start", async (data) => {
      const { cmd, args } = data as { cmd: string; args: Record<string, unknown> };
      await this.handleCommand(cmd, args);
    });

    const unsub2 = this.observer.subscribe((state: AppState) => {
      if (state.commandStatus === "error") {
        this.handleError(state);
      }
    });

    this.unsubs = [unsub1, unsub2];
  }

  stopListening(): void {
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
  }

  private async handleCommand(cmd: string, _args: Record<string, unknown>): Promise<void> {
    this.observer.setState({ currentCommand: cmd, commandStatus: "running" });

    try {
      if (cmd.startsWith("trade:")) {
        await this.handleTradeCommand(cmd);
      } else if (cmd.startsWith("workers:")) {
        await this.handleWorkersCommand(cmd);
      }

      this.observer.setState({ commandStatus: "success" });
    } catch (error) {
      this.observer.setState({ commandStatus: "error" });
      this.observer.emit("command:error", { cmd, error });
    }
  }

  private async handleTradeCommand(cmd: string): Promise<void> {
    if (cmd === "trade:deploy") {
      await this.adapters.cloudflare.deployWorker("trade-worker");
    }
  }

  private async handleWorkersCommand(_cmd: string): Promise<void> {
    // Placeholder for workers command handling
  }

  private handleError(state: AppState): void {
    if (state.lastError) {
      console.error("Command failed:", state.lastError.message);
    }
  }
}
