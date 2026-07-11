// Source: workers/agent-worker/src/providers.ts (lines 102-142)
// Listing id: provider-fallback
// Caption: ProviderManager fallback chain with full-chain retry recursion
  async run(request: AIRequest): Promise<ProviderResult> {
    const config = await this.loadConfig();
    return this.runWithFallback(
      request,
      config.fallbackChain,
      config.retryCount
    );
  }

  private async runWithFallback(
    request: AIRequest,
    chain: ProviderName[],
    retries: number
  ): Promise<ProviderResult> {
    let lastError: string = "";

    for (const provider of chain) {
      try {
        const result = await this.runProvider(provider, request);
        if (result.success) {
          return result;
        }
        lastError = result.error || "Unknown error";
      } catch (error: unknown) {
        lastError = error instanceof Error ? error.message : String(error);
        this.logger.warn("Provider failed", { provider, error: lastError });
      }
    }

    if (retries > 0) {
      await new Promise((r) => setTimeout(r, 1000));
      return this.runWithFallback(request, chain, retries - 1);
    }

    return {
      success: false,
      error: `All providers failed. Last error: ${lastError}`,
      provider: chain[0],
      model: "",
    };
  }
