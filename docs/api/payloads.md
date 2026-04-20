# 📦 API Payloads

> Standardized request payloads for inter-worker communication

## Standard Request Wrapper

When workers communicate with each other via Service Bindings, they wrap their requests in a standard envelope:

```json
{
  "requestId": "uuid-v4-string",
  "internalAuthKey": "secret-key",
  "payload": {
    // Service-specific payload
  }
}
```

## Service-Specific Payloads

### Trade Worker (`TRADE_SERVICE`)

**Process Trade:**

```json
{
  "exchange": "mexc",
  "action": "LONG",
  "symbol": "BTC_USDT",
  "quantity": 0.01
}
```

### Telegram Worker (`TELEGRAM_SERVICE`)

**Send Notification:**

```json
{
  "chatId": "123456789",
  "message": "Trade executed successfully: LONG BTC_USDT",
  "parseMode": "HTML"
}
```

### D1 Worker (`D1_SERVICE`)

**Execute Query:**

```json
{
  "query": "INSERT INTO system_logs (level, message) VALUES (?, ?)",
  "params": ["INFO", "Trade executed"]
}
```

### Home Assistant Worker (`HOME_ASSISTANT_SERVICE`)

**Process Action:**

```json
{
  "action": "light.turn_on",
  "entity_id": "light.living_room"
}
```

## Next Steps

- [API Endpoints](endpoints.md)
- [API Responses](responses.md)
