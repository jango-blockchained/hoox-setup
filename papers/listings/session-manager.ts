// Source: workers/hoox/src/sessionManager.ts (lines 12-37)
// Listing id: session-manager
// Caption: SESSIONS_KV session creation with 3600s TTL
export async function getOrCreateSession(
  kv: KVNamespace | undefined,
  sessionId?: string | null
): Promise<{ sessionId: string; isNew: boolean }> {
  const id = sessionId || crypto.randomUUID();

  if (!kv) {
    return { sessionId: id, isNew: !sessionId };
  }

  try {
    const existing = await kv.get(id);
    const isNew = !existing;

    if (isNew || existing) {
      await kv.put(id, JSON.stringify({ lastSeen: new Date().toISOString() }), {
        expirationTtl: SESSION_TTL,
      });
    }

    return { sessionId: id, isNew };
  } catch (error: unknown) {
    logger.error("KV Session Error", { error });
    return { sessionId: id, isNew: !sessionId };
  }
}
