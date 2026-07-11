// Source: workers/trade-worker/src/binance-client.ts (lines 40-78)
// Listing id: binance-signature
// Caption: Binance futures client authenticated request signing
  /**
   * Generates HMAC-SHA256 signature for authenticated requests.
   */
  protected async generateSignature(
    params: Record<string, string | number | boolean>
  ): Promise<string> {
    // Binance expects URLSearchParams format for signature
    const queryString = new URLSearchParams(
      params as Record<string, string>
    ).toString();

    return this.cryptoSign(queryString);
  }

  /**
   * Makes an authenticated request to the Binance API.
   */
  private async makeRequest<T>(
    method: string,
    path: string,
    params: Record<string, string | number | boolean> = {}
  ): Promise<T> {
    const timestamp = Date.now();
    const allParams = { ...params, timestamp };

    const signature = await this.generateSignature(allParams);
    const stringParams: Record<string, string> = {};
    Object.entries(allParams).forEach(([k, v]) => {
      stringParams[k] = String(v);
    });
    const queryParams = new URLSearchParams(stringParams).toString();
    const url = `${this.baseUrl}${path}?${queryParams}&signature=${signature}`;

    const options: RequestInit = {
      method: method,
      headers: {
        "Content-Type": "application/json",
        "X-MBX-APIKEY": this.apiKey,
      },
