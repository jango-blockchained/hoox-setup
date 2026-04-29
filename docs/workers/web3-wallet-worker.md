# Web3 Wallet Worker

**Last Updated:** April 2026

A Cloudflare® Worker service designed to manage interactions with Web3 wallets (e.g., signing transactions, querying balances). This worker accepts requests via a standardized `/process` endpoint, typically from the `hoox` or other authenticated internal services.

## Features

- Securely handles wallet operations.
- Interfaces with blockchain networks via RPC endpoints.
- Secure authentication via shared internal key.
- Uses encrypted storage for sensitive keys or seed phrases (using Cloudflare® Secrets).

## Prerequisites

- Node.js >= 16
- Bun
- Wrangler CLI
- Cloudflare® Workers account
- RPC endpoint URL for the desired blockchain network.
- Wallet private key or seed phrase (to be stored securely).

## Setup

1.  Install dependencies:
    ```bash
    bun install
    ```
2.  Set your Cloudflare® account ID in `wrangler.jsonc`.
3.  Configure Secrets (via Cloudflare® dashboard Secrets Store or `wrangler secret put`):
    - `INTERNAL_KEY_BINDING`: The **shared** secret key used for authentication with the `hoox` or other internal services.
    - `WALLET_PRIVATE_KEY` or `WALLET_SEED_PHRASE`: Your wallet's sensitive information. **Store this securely!**
    - `RPC_URL`: The URL for the blockchain RPC endpoint.
4.  Update `wrangler.jsonc` with appropriate bindings and variables. Example:
    ```jsonc
    {
      "name": "web3-wallet-worker",
      "main": "src/index.ts",
      "compatibility_date": "2025-03-07",
      "compatibility_flags": ["nodejs_compat"],
      "account_id": "YOUR_CLOUDFLARE_ACCOUNT_ID",
      "vars": {
        "RPC_URL": null
      },
      "secrets": [
        "INTERNAL_KEY_BINDING",
        "WALLET_PRIVATE_KEY"
      ]
    }
    ```
5.  Update the corresponding `worker-configuration.d.ts` file.
6.  For local development, create a `.dev.vars` file and define the secrets/variables:
    ```.dev.vars
    # Mock secret bindings and variables for local dev:
    INTERNAL_KEY_BINDING="your_shared_internal_secret"
    WALLET_PRIVATE_KEY="your_test_wallet_private_key"
    RPC_URL="http://localhost:8545"
    ```

## Development

Run locally:

```bash
bun run dev
```

Deploy:

```bash
bun run deploy
```

## API Interface

This worker **only** accepts requests from authenticated internal services (like `hoox`) on the `/process` endpoint.

- **Method:** `POST`
- **Endpoint:** `/process`
- **Content-Type:** `application/json`
- **Expected Request Body:**

  ```json
  {
    "requestId": "<uuid_from_caller>",
    "internalAuthKey": "YOUR_INTERNAL_SHARED_SECRET",
    "payload": {
      "action": "sendTransaction",
      "network": "ethereum",
      "to": "0xRecipientAddress...",
      "value": "0.1",
      "data": "0x...",
      "message": "Sign this message"
    }
  }
  ```

- **Response Format:**

  **Success:**

  ```json
  {
    "success": true,
    "result": { ... },
    "error": null
  }
  ```

  **Error:**

  ```json
  {
    "success": false,
    "result": null,
    "error": "<Error message describing the failure>"
  }
  ```

## Security

- All requests _must_ be received on the `/process` endpoint.
- Requests _must_ include a valid `internalAuthKey` in the body, matching the `INTERNAL_KEY_BINDING` secret.
- Private keys/seed phrases are stored securely using Cloudflare® Workers Secrets and **should never be hardcoded**.
- Ensure the RPC URL is trusted.

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
