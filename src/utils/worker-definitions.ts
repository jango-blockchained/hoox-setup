/**
 * WORKER TYPE DEFINITIONS
 * ----------------------
 * This file provides shared type definitions for all workers.
 * 
 * DEVELOPMENT NOTES:
 * 
 * 1. The project's TypeScript typing is still being improved - some errors may exist.
 * 2. Cloudflare Workers have specialized bindings that may not be fully covered by
 *    standard @cloudflare/workers-types. We've provided custom type definitions for
 *    some of these cases.
 * 3. All new additions should be properly typed to avoid increasing technical debt.
 * 4. When using these types, you should use `import type { ... }` to avoid 
 *    runtime dependencies.
 */

import type { ExecutionContext, KVNamespace } from "@cloudflare/workers-types";

// Define Ai interface since @cloudflare/ai has been deprecated
export interface Ai {
  run: (model: string, options: Record<string, unknown>) => Promise<unknown>;
}

// Common bindings across workers
export interface SecretBinding {
  get(name: string): Promise<string | null>;
}

// Telegram worker types
export interface TelegramMessageMetadata {
  messageId: number;
  chatId: number;
  date: number;
  text: string;
  [key: string]: unknown;
}

export interface VectorizeMatches {
  matches: Array<{
    id: string;
    score: number;
    metadata: Record<string, unknown>;
  }>;
}

// Define Vectorize-related interfaces
export interface VectorizeVector {
  id: string;
  values: number[];
  metadata: Record<string, unknown>;
}

export interface VectorizeVectorMetadata {
  [key: string]: string | number | boolean | null;
}

// Trade worker types
export interface TradePayload {
  exchange: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  quantity: number;
  price?: number;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeInForce?: string;
  closePosition?: boolean;
  reduceOnly?: boolean;
}

// DEX trade types
export interface DexTradePayload {
  exchange: string;
  action: 'swap' | 'add_liquidity' | 'remove_liquidity';
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  recipient?: string;
  slippage?: number;
}

// Alias for backward compatibility
export type DexWebhookPayload = DexTradePayload;

// Standard response format
export interface StandardResponse {
  success: boolean;
  result?: Record<string, unknown> | null;
  error?: string | null;
}

// Generic trade result
export interface TradeResult {
  orderId?: string;
  transactionHash?: string;
  status: string;
  [key: string]: unknown;
}

// Web3 transaction
export interface Web3TransactionPayload {
  chain: string;
  to: string;
  data: string;
  value?: string;
  gas?: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
  nonce?: number;
}

// Webhook payload for centralized exchanges
export interface CexTradePayload {
  exchange?: string;
  symbol?: string;
  side?: 'buy' | 'sell';
  type?: 'market' | 'limit';
  price?: number;
  quantity?: number;
  leverage?: number;
  stopLoss?: number;
  takeProfit?: number;
  timeInForce?: string;
  closePosition?: boolean;
  reduceOnly?: boolean;
}

// Common webhook payload structure
export interface WebhookPayload {
  exchange?: string;
  notify?: boolean;
  requestId?: string;
  timestamp?: number;
  tradeData?: CexTradePayload;
  dexData?: DexTradePayload;
  web3Data?: Web3TransactionPayload;
}

// Generic worker response
export interface WorkerResponse {
  success: boolean;
  message?: string;
  data?: unknown;
  error?: string;
}

// Trade signal record for database
export interface TradeSignalRecord {
  id?: number;
  requestId: string;
  exchange: string;
  symbol: string;
  side: string;
  type: string;
  price: number | null;
  quantity: number;
  leverage: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  status: string;
  timestamp: string;
  orderId: string | null;
  errorMessage: string | null;
}

// Request validation result
export interface ValidationResult {
  valid: boolean;
  errors?: string[];
}

// Interface for environments with KV
export interface EnvWithKV {
  REPORT_KV: KVNamespace;
  [key: string]: unknown;
}

// Process request body
export interface ProcessRequestBody {
  requestId: string;
  [key: string]: unknown;
}

// Standard webhook payloads
export interface WebhookRequest {
  path: string;
  headers: Record<string, string>;
  body: string;
}

// Export using 'export type' syntax for these imported types
export type { ExecutionContext }; 