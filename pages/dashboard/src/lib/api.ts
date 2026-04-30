function getApiUrl(key: string): string {
  const envKey = `${key}_URL`;
  const envUrl = process.env[envKey];
  if (envUrl) return envUrl;
  
  const defaultUrls: Record<string, string> = {
    d1Service: "https://d1-worker.cryptolinx.workers.dev",
    tradeService: "https://trade-worker.cryptolinx.workers.dev",
    agentService: "https://agent-worker.cryptolinx.workers.dev",
    telegramService: "https://telegram-worker.cryptolinx.workers.dev",
  };
  
  return defaultUrls[key] || "";
}

export interface DashboardStats {
  totalTrades: number;
  openPositions: number;
  winRate: string;
}

export interface Position {
  id: number;
  exchange: string;
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  currentPrice?: number;
  unrealizedPnl?: number;
  leverage: number;
  status: "OPEN" | "CLOSED";
  openedAt: number;
  updatedAt: number;
}

export interface SystemLog {
  id: number;
  level: string;
  message: string;
  timestamp: number;
  source?: string;
}

export interface WorkerStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  latency?: number;
  lastCheck?: string;
}

class ApiClient {
  private internalKey: string | undefined;

  setInternalKey(key: string) {
    this.internalKey = key;
  }

  private async fetchWithAuth(endpoint: string, options: RequestInit = {}) {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (this.internalKey) {
      (headers as Record<string, string>)["X-Internal-Auth-Key"] = this.internalKey;
    }

    const response = await fetch(endpoint, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Dashboard Stats
  async getStats(): Promise<{ success: boolean; stats: DashboardStats; recentActivity: unknown[] }> {
    const data = await this.fetchWithAuth(`${getApiUrl("d1Service")}/api/dashboard/stats`);
    return data as { success: boolean; stats: DashboardStats; recentActivity: unknown[] };
  }

  // Positions
  async getPositions(): Promise<{ success: boolean; positions: Position[] }> {
    const data = await this.fetchWithAuth(`${getApiUrl("d1Service")}/api/dashboard/positions`);
    return data as { success: boolean; positions: Position[] };
  }

  async closePosition(
    exchange: string,
    symbol: string,
    side: string,
    size: number
  ): Promise<{ success: boolean; error?: string }> {
    return this.fetchWithAuth(`${getApiUrl("tradeService")}/webhook`, {
      method: "POST",
      body: JSON.stringify({
        exchange,
        symbol,
        action: side === "LONG" ? "CLOSE_LONG" : "CLOSE_SHORT",
        quantity: size,
      }),
    }) as Promise<{ success: boolean; error?: string }>;
  }

  // Logs
  async getLogs(limit = 50): Promise<{ success: boolean; logs: SystemLog[] }> {
    const data = await this.fetchWithAuth(`${getApiUrl("d1Service")}/api/dashboard/logs?limit=${limit}`);
    const result = data as any;
    return { success: result?.success || false, logs: result?.logs || [] };
  }

  // Agent Status
  async getAgentStatus(): Promise<{ success: boolean; status: string; config: unknown }> {
    const data = await this.fetchWithAuth(`${getApiUrl("agentService")}/agent/status`);
    const result = data as any;
    return { success: result?.success || false, status: result?.status || "", config: result?.config };
  }

  // Agent Health
  async getAgentHealth(): Promise<{ success: boolean; providers: unknown[] }> {
    const data = await this.fetchWithAuth(`${getApiUrl("agentService")}/agent/health`);
    const result = data as any;
    return { success: result?.success || false, providers: result?.providers || [] };
  }

  // Worker Health Check
  async checkWorkerHealth(workerName: string, url: string): Promise<WorkerStatus> {
    const start = Date.now();
    try {
      const response = await fetch(`${url}/health`, { method: "GET" });
      const latency = Date.now() - start;
      return {
        name: workerName,
        status: response.ok ? "healthy" : "degraded",
        latency,
        lastCheck: new Date().toISOString(),
      };
    } catch {
      return {
        name: workerName,
        status: "down",
        latency: undefined,
        lastCheck: new Date().toISOString(),
      };
    }
  }

  // Get all worker statuses
  async getWorkersStatus(): Promise<WorkerStatus[]> {
    const workers = [
      { name: "d1-worker", url: getApiUrl("d1Service") },
      { name: "trade-worker", url: getApiUrl("tradeService") },
      { name: "agent-worker", url: getApiUrl("agentService") },
      { name: "telegram-worker", url: getApiUrl("telegramService") },
    ];

    return Promise.all(
      workers.map((w) => this.checkWorkerHealth(w.name, w.url))
    );
  }
  async getHousekeeping(): Promise<{ timestamp?: string; checks?: any[]; error?: string }> {
    try {
      const response = await fetch('/api/housekeeping', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
         throw new Error(`API Error: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (e: any) {
      return { error: e.message };
    }
  }

  async getSecretsStatus(): Promise<{ success: boolean; secrets: { name: string; synced: boolean }[]; error?: string }> {
    const data = await this.fetchWithAuth('/api/secrets');
    return data as { success: boolean; secrets: { name: string; synced: boolean }[]; error?: string };
  }

  async syncSecretToPages(secretName: string, secretValue: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const data = await this.fetchWithAuth('/api/secrets', {
      method: 'POST',
      body: JSON.stringify({
        action: 'sync-to-pages',
        secretName,
        secretValue,
      }),
    });
    return data as { success: boolean; message?: string; error?: string };
  }
}

export const api = new ApiClient();
