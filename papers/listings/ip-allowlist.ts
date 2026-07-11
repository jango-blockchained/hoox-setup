// Source: workers/hoox/src/ipAllowlist.ts (lines 21-50)
// Listing id: ip-allowlist
// Caption: TradingView IP allow-list with KV override
export async function checkIpAllowlist(
  kv: KVNamespace | undefined,
  clientIp: string | null | undefined
): Promise<{
  allowed: boolean;
  reason?: string;
  config: IpCheckConfig;
}> {
  const defaultConfig: IpCheckConfig = {
    enabled: true,
    allowedIps: TRADINGVIEW_ALLOWED_IPS,
  };

  if (!clientIp) {
    return {
      allowed: false,
      reason: "No client IP provided",
      config: defaultConfig,
    };
  }

  try {
    const config = await loadIpConfig(kv);
    if (!config.enabled) {
      return { allowed: true, config };
    }

    if (config.allowedIps.has(clientIp)) {
      return { allowed: true, config };
    }
