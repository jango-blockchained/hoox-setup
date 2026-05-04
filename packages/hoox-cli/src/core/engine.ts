import type { Engine, CommandContext, AppState } from "./types.js";
import { CLIError } from "./errors.js";

export class AppEngine implements Engine {
  private observer: import("./types.js").Observer;
  private adapters: CommandContext["adapters"];
  private unsubs: (() => void)[] = [];

  constructor(observer: import("./types.js").Observer, adapters: CommandContext["adapters"]) {
    this.observer = observer;
    this.adapters = adapters;
  }

  async initialize(): Promise<void> {
    await this.adapters.cloudflare.testConnection();
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

    const interval = setInterval(() => {
      this.observer.updateSystemMetrics();
    }, 30000);

    this.unsubs = [unsub1, unsub2, () => clearInterval(interval)];
  }

  stopListening(): void {
    this.unsubs.forEach((fn) => fn());
    this.unsubs = [];
  }

  private async handleCommand(cmd: string, args: Record<string, unknown>): Promise<void> {
    this.observer.setState({ currentCommand: cmd, commandStatus: "running" });

    try {
      if (cmd.startsWith("trade:")) {
        await this.handleTradeCommand(cmd, args);
      } else if (cmd.startsWith("workers:")) {
        await this.handleWorkersCommand(cmd, args);
      }

      this.observer.setState({ commandStatus: "success" });
    } catch (error) {
      this.observer.setState({ commandStatus: "error" });
      this.observer.emit("command:error", { cmd, error });
    }
  }

  private async handleTradeCommand(cmd: string, args: Record<string, unknown>): Promise<void> {
    if (cmd === "trade:deploy") {
      await this.adapters.cloudflare.deployWorker("trade-worker");
    }
  }

  private async handleWorkersCommand(cmd: string, args: Record<string, unknown>): Promise<void> {
    // Placeholder for workers command handling
  }

  private handleError(state: AppState): void {
    if (state.lastError) {
      console.error("Command failed:", state.lastError.message);
    }
  }
}
