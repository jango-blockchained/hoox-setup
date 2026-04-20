# 🐛 Debugging

> Tools and techniques for debugging Hoox workers

## Local Debugging

When running locally with `bun run scripts/manage.ts workers dev <worker-name>`, standard `console.log` statements will output directly to your terminal.

If you encounter issues with inter-worker communication, ensure that:
1. Both workers are running.
2. The ports align with what Wrangler expects.
3. The `internalAuthKey` matches between `.dev.vars` files.

## Production Debugging

Cloudflare® provides `wrangler tail` to view real-time logs from your deployed workers.

```bash
# View logs for the hoox gateway
npx wrangler tail hoox

# View logs for the trade worker
npx wrangler tail trade-worker
```

### Logging Best Practices

- Always use structured JSON logs when possible.
- Include the `requestId` in logs to trace a single request across multiple workers.
- Avoid logging sensitive information such as API keys or user passwords.

## Common Issues

### 1. `Worker error: 401 Unauthorized`
Check that your `INTERNAL_KEY` matches across all workers.

### 2. `D1_ERROR: no such table`
You haven't run the database migrations. Ensure your database is initialized:
```bash
npx wrangler d1 execute DB --local --file=schema.sql
```

## Next Steps

- [Testing](testing.md)
- [Production Setup](../deployment/production.md)

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
