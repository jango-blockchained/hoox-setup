import { EventEmitter } from "node:events";
import type {
  Observer,
  AppState,
  StateListener,
  EventHandler,
  UnsubscribeFn,
} from "./types.js";

export class AppObserver implements Observer {
  private state: AppState;
  private emitter = new EventEmitter();
  private listeners: Set<StateListener> = new Set();

  constructor(initialState?: Partial<AppState>) {
    this.state = {
      commandStatus: "idle",
      workers: {},
      system: {
        bunVersion: Bun.version,
        memoryUsage: process.memoryUsage(),
      },
      ...initialState,
    };
  }

  getState(): AppState {
    return structuredClone(this.state);
  }

  setState(partial: Partial<AppState>): void {
    const prev = this.state;
    this.state = { ...this.state, ...partial };
    this.listeners.forEach((fn) => fn(this.state));
    this.emitter.emit("state:change", { prev, next: this.state });
  }

  subscribe(listener: StateListener): UnsubscribeFn {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit(event: string, data?: unknown): void {
    this.emitter.emit(event, data);
  }

  on(event: string, handler: EventHandler): UnsubscribeFn {
    this.emitter.on(event, handler);
    return () => this.emitter.off(event, handler);
  }

  updateSystemMetrics(): void {
    this.setState({
      system: {
        ...this.state.system,
        memoryUsage: process.memoryUsage(),
      },
    });
  }
}
