# @hoox/shared

**Last Updated:** April 2026

A shared utility library used across the Hoox Trading System workers. It provides common types, response helpers, and utility functions.

## Contents

### 1. `exchange-client.ts`
Base classes and utilities for implementing exchange clients (Binance, MEXC, Bybit).

### 2. `json-response.ts`
Standardized JSON response formats for all API endpoints.

### 3. `kvUtils.ts`
Helpers for interacting with Cloudflare KV storage (fetching, parsing configurations).

### 4. `types.ts`
Common TypeScript interfaces used across components (e.g., configurations, secrets).

## Usage

This package is installed locally in the mono-repo and shared across workers.

```json
"dependencies": {
  "@hoox/shared": "workspace:*"
}
```

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
