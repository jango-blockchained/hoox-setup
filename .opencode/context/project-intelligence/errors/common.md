<!-- Context: project-intelligence/errors | Priority: medium | Version: 1.0 | Updated: 2026-05-03 -->

# Common Errors

**Concept**: Recurring issues and their fixes when working with Cloudflare Workers and Bun.

## Error: `NODEJS_COMPAT` required

```
Error: The 'node:path' module is not supported in Edge Workers
```

**Fix**: Add `"compatibility_flags": ["nodejs_compat"]` to `wrangler.jsonc`

## Error: `internalAuthKey` mismatch

```
401 Unauthorized between workers
```

**Fix**: Ensure `INTERNAL_KEY` is set in both `.dev.vars` and `wrangler secret put`

## Error: Service Binding not found

```
TypeError: env.TRADE_SERVICE is undefined
```

**Fix**: Add service binding in `wrangler.jsonc` `services` array and redeploy

## Error: D1 not available locally

**Fix**: Run `bunx wrangler d1 create` and update `wrangler.jsonc` with database_id

## Error: Next.js build fails on Cloudflare

**Fix**: Use `bunx opennextjs-cloudflare build` not `next build`

## 📂 Codebase References

**Worker config**: `workers/*/wrangler.jsonc`
**Secrets**: `hoox secrets update-cf` to push to Cloudflare
