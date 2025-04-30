# Web3 Wallet Worker

[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/) [![Runtime](https://img.shields.io/badge/Runtime-Bun-black?logo=bun)](https://bun.sh) [![Platform](https://img.shields.io/badge/Platform-Cloudflare%20Edge%20Workers-orange?logo=cloudflare)](https://workers.cloudflare.com/) [![License](https://img.shields.io/badge/License-CC%20BY%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by/4.0/) [![Build Status](https://img.shields.io/badge/Build-TODO-lightgrey?style=for-the-badge)](https://github.com/jango-blockchained/hoox-cf-edge-worker/actions) <!-- TODO: Update Build Status link -->

**[Main Repository](https://github.com/jango-blockchained/hoox-cf-edge-worker)** <!-- TODO: Update Main Repo link -->

A Cloudflare Worker service designed to manage interactions with Web3 wallets (e.g., signing transactions, querying balances). This worker accepts requests via a standardized `/process` endpoint, typically from the `webhook-receiver` or other authenticated internal services.

## Features

- Securely handles wallet operations.
- Interfaces with blockchain networks via RPC endpoints.
- Secure authentication via shared internal key.
- Uses encrypted storage for sensitive keys or seed phrases (using Cloudflare Secrets).

## Prerequisites

- Node.js >= 16
- Bun
- Wrangler CLI
- Cloudflare Workers account
- RPC endpoint URL for the desired blockchain network.
- Wallet private key or seed phrase (to be stored securely).

## Setup

1.  Install dependencies:
    ```bash
    bun install
    ```
2.  Set your Cloudflare account ID in `wrangler.jsonc`.
3.  Configure Secrets (via Cloudflare dashboard Secrets Store or `wrangler secret put`):
    - `INTERNAL_KEY_BINDING`: The **shared** secret key used for authentication with the `webhook-receiver` or other internal services.
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
        "RPC_URL": null // Will be populated by wrangler secret put RPC_URL
      },
      "secrets": [
        "INTERNAL_KEY_BINDING",
        "WALLET_PRIVATE_KEY" // Or WALLET_SEED_PHRASE
      ]
      // Add other bindings if needed (KV, Queues, etc.)
    }
    ```
5.  Update the corresponding `worker-configuration.d.ts` file.
6.  For local development, create a `.dev.vars` file and define the secrets/variables:
    ```.dev.vars
    # Mock secret bindings and variables for local dev:
    INTERNAL_KEY_BINDING="your_shared_internal_secret"
    WALLET_PRIVATE_KEY="your_test_wallet_private_key"
    RPC_URL="http://localhost:8545" # Or a testnet RPC
    ```

## Development

Run locally:

```bash
# Ensure you have a local RPC node or are using a testnet RPC defined in .dev.vars
bun run dev
```

Deploy:

```bash
bun run deploy
```

## API Interface

This worker **only** accepts requests from authenticated internal services (like `webhook-receiver`) on the `/process` endpoint.

- **Method:** `POST`
- **Endpoint:** `/process`
- **Content-Type:** `application/json`
- **Expected Request Body:**

  ```json
  {
    "requestId": "<uuid_from_caller>",
    "internalAuthKey": "YOUR_INTERNAL_SHARED_SECRET", // Validated against INTERNAL_KEY_BINDING
    "payload": {
      // --- Web3-specific payload fields below ---
      "action": "sendTransaction", // e.g., "getBalance", "signMessage", "sendTransaction"
      "network": "ethereum", // Optional: Specify network if supporting multiple
      "to": "0xRecipientAddress...", // Required for sendTransaction
      "value": "0.1", // Required for sendTransaction (in native currency, e.g., ETH)
      "data": "0x...", // Optional: Transaction data payload
      "message": "Sign this message" // Required for signMessage
      // ... other parameters based on action
    }
  }
  ```

- **Response Format:**

  **Success:**

  ```json
  {
    "success": true,
    "result": {
      /* Result of the action, e.g., transaction hash, balance, signature */
    },
    "error": null
  }
  ```

  **Error:**

  ```json
  {
    "success": false,
    "result": null,
    "error": "<Error message describing the failure (e.g., Authentication failed, Invalid action, RPC request failed: ...)>"
  }
  ```

## Security

- All requests _must_ be received on the `/process` endpoint.
- Requests _must_ include a valid `internalAuthKey` in the body, matching the `INTERNAL_KEY_BINDING` secret.
- Private keys/seed phrases are stored securely using Cloudflare Workers Secrets and **should never be hardcoded**.
- Ensure the RPC URL is trusted.

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 