// Source: workers/trade-worker/src/bybit-client.ts (lines 59-65)
// Listing id: bybit-signature
// Caption: Bybit V5 HMAC signature payload construction
  private async signRequest(
    timestamp: number,
    paramsStr: string
  ): Promise<string> {
    const signaturePayload = `${timestamp}${this.apiKey}${this.recvWindow}${paramsStr}`;
    return this.cryptoSign(signaturePayload);
  }
