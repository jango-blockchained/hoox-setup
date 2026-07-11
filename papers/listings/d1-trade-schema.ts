// Source: packages/shared/src/d1/schemas.ts (lines 10-43)
// Listing id: d1-trade-schema
// Caption: Zod runtime schema mirroring D1 trades and positions tables
export const TradeRecordSchema = z
  .object({
    id: z.string(),
    signal_id: z.string().nullable().optional(),
    timestamp: z.number().int().positive(),
    exchange: z.string().min(1),
    symbol: z.string().min(1),
    action: z.string().min(1),
    quantity: z.number().nullable(),
    price: z.number().nullable(),
    leverage: z.number().nullable(),
    status: z.string().min(1),
    error_message: z.string().nullable().optional(),
    raw_response: z.string().nullable().optional(),
    created_at: z.number().int().optional(),
  })
  .strict();

export const PositionRecordSchema = z
  .object({
    id: z.string(),
    exchange: z.string().min(1),
    symbol: z.string().min(1),
    side: z.enum(["LONG", "SHORT"]),
    entry_price: z.number().nullable().optional(),
    mark_price: z.number().nullable().optional(),
    liquidation_price: z.number().nullable().optional(),
    leverage: z.number().nullable().optional(),
    size: z.number().nullable(),
    unrealized_pnl: z.number().nullable().optional(),
    status: z.enum(["OPEN", "CLOSED"]),
    updated_at: z.number().int(),
  })
  .strict();
