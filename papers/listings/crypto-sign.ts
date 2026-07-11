// Source: packages/shared/src/exchanges/base-exchange-client.ts (lines 86-111)
// Listing id: crypto-sign
// Caption: HMAC-SHA256 signing via Web Crypto (shared base client)
  private async importKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    return crypto.subtle.importKey(
      "raw",
      encoder.encode(this.apiSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
  }

  /**
   * Signs data using HMAC-SHA256 with the API secret.
   */
  protected async cryptoSign(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await this.importedKeyPromise;
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(data)
    );
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
