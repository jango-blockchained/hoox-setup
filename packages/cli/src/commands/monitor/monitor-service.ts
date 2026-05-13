import { ConfigService } from "../../services/config/index.js";
import type { WorkerHealthResult } from "./types.js";

export class MonitorService {
  private configService: ConfigService;

  constructor(configService?: ConfigService) {
    this.configService = configService ?? new ConfigService();
  }

  async checkAllWorkerHealth(): Promise<{
    workers: WorkerHealthResult[];
    healthyCount: number;
    degradedCount: number;
    unreachableCount: number;
  }> {
    await this.configService.load();
    const global = this.configService.getGlobal();
    const prefix = global.subdomain_prefix ?? "hoox";
    const enabled = this.configService.listEnabledWorkers();

    const results: WorkerHealthResult[] = [];
    let healthy = 0;
    let degraded = 0;
    let unreachable = 0;

    for (const name of enabled) {
      const url = `https://${name}.${prefix}.workers.dev/health`;
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
          results.push({
            worker: name,
            status: "healthy",
            statusCode: response.status,
          });
          healthy++;
        } else {
          results.push({
            worker: name,
            status: "degraded",
            statusCode: response.status,
          });
          degraded++;
        }
      } catch (err) {
        results.push({
          worker: name,
          status: "unreachable",
          error: err instanceof Error ? err.message : String(err),
        });
        unreachable++;
      }
    }

    return {
      workers: results,
      healthyCount: healthy,
      degradedCount: degraded,
      unreachableCount: unreachable,
    };
  }
}
