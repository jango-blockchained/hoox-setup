# 📊 Monitoring

> Keeping an eye on system health and performance

## Cloudflare Dashboard

The Cloudflare Dashboard provides out-of-the-box monitoring for your workers:

1. Go to **Workers & Pages**.
2. Select your worker.
3. The **Metrics** tab shows:
   - Requests
   - Errors
   - CPU Time
   - Subrequests

## D1 Dashboard

To view the health and status of your trading database, you can visit the **Storage & Databases > D1** section in the dashboard to see query volume and execution time.

## Custom Monitoring

If you want custom alerts (e.g., failed trades), the `telegram-worker` can be used to send error logs directly to an admin channel in Telegram.

Example usage inside a worker:
```typescript
if (!response.ok) {
  await env.TELEGRAM_SERVICE.fetch('https://telegram-worker/process', {
    method: 'POST',
    body: JSON.stringify({
      message: `🚨 Critical Error in Trade Execution: ${response.statusText}`
    })
  });
}
```

## Next Steps

- [Debugging](../development/debugging.md)