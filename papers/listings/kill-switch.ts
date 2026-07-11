// Source: workers/hoox/src/killSwitch.ts (lines 15-31)
// Listing id: kill-switch
// Caption: Global kill switch read from canonical KV key
export async function checkKillSwitch(
  kv: KVNamespace | undefined
): Promise<{ enabled: boolean; error?: string }> {
  try {
    if (!kv) {
      return { enabled: false };
    }
    const killSwitchVal = await kv.get(KV_KILL_SWITCH_KEY);
    if (killSwitchVal && killSwitchVal.toLowerCase() === "true") {
      return { enabled: true };
    }
    return { enabled: false };
  } catch (error: unknown) {
    logger.error("Error reading kill switch KV", { error });
    return { enabled: false, error: String(error) };
  }
}
