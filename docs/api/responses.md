# 📨 API Responses

> Standardized response formats for inter-worker communication

## Standard Response Wrapper

All workers return a consistent JSON response format to ensure predictable error handling and parsing across the system.

```json
{
  "success": true,
  "requestId": "uuid-v4-string",
  "result": {
    // Service-specific response data
  },
  "error": null,
  "message": "Operation completed successfully"
}
```

## Success Responses

### Trade Worker Success

```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "result": {
    "orderId": "123456789",
    "status": "FILLED",
    "executedPrice": 64230.5
  }
}
```

### Telegram Worker Success

```json
{
  "success": true,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "result": {
    "messageId": 402,
    "delivered": true
  }
}
```

## Error Responses

When an operation fails, the `success` flag is `false`, and the `error` field contains the error message or code.

```json
{
  "success": false,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "error": "INSUFFICIENT_FUNDS",
  "message": "Account balance is too low to execute this trade."
}
```

### Common Error Codes

- `UNAUTHORIZED`: Invalid or missing `internalAuthKey` or API key.
- `INVALID_PAYLOAD`: The request payload was missing required fields or incorrectly formatted.
- `SERVICE_UNAVAILABLE`: The target worker or external API (e.g., Exchange) is down.
- `RATE_LIMITED`: Too many requests.

## Next Steps

- [API Endpoints](endpoints.md)
- [API Payloads](payloads.md)
