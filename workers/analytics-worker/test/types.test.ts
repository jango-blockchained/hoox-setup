// workers/analytics-worker/test/types.test.ts
import type { Env, DataPoint } from "../src/types";

export function test_env_interface() {
  const env: Env = {
    ANALYTICS_ENGINE: {} as any,
    CLOUDFLARE_API_TOKEN: "test-token",
    CLOUDFLARE_ACCOUNT_ID: "test-account"
  };
  return typeof env.ANALYTICS_ENGINE === "object";
}

export function test_data_point_interface() {
  const dp: DataPoint = {
    blobs: ["trade", "trade-worker", "success", "binance", "BTCUSDT"],
    doubles: [0.5, 45000.50, 1200],
    indexes: ["req-123"]
  };
  return dp.blobs.length === 5 && dp.doubles.length === 3;
}
