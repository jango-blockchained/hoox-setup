<!-- Context: project-intelligence/errors | Priority: medium | Version: 2.0 | Updated: 2026-05-14 -->

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

## Error: `worker-configuration.d.ts` type mismatch

```
Type 'string' is not assignable to type 'never'
```

**Cause**: Wrangler generated types (`worker-configuration.d.ts`) are stale after `wrangler.jsonc` changes (new bindings, renamed vars, etc.)

**Fix**: Regenerate types from any directory:
```bash
npx wrangler types --config workers/<name>/wrangler.jsonc
```

## Error: `@cloudflare/workers-types` conflicts with generated types

```
Property 'DB' does not exist on type 'Env'
```

**Cause**: Having both `@cloudflare/workers-types` and generated `worker-configuration.d.ts` causes type conflicts for binding names.

**Fix**: Remove `@cloudflare/workers-types` from `tsconfig.json` `types` array. Use generated `worker-configuration.d.ts` exclusively, which provides accurate per-worker binding types.

## 📂 Codebase References

**Worker config**: `workers/*/wrangler.jsonc`
**Secrets**: `hoox secrets update-cf` to push to Cloudflare
