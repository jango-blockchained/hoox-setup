import { defineConfig } from 'vitest/config';
import { cloudflareTest } from '@cloudflare/vitest-pool-workers';

export default defineConfig({
  plugins: [
    cloudflareTest({
      remoteBindings: false,
      wrangler: { configPath: './workers/hoox/wrangler.jsonc' },
      miniflare: {
        workers: [
          {
            name: 'trade-worker',
            modules: true,
            script: 'export default { fetch: () => new Response(JSON.stringify({success: true})) }'
          },
          {
            name: 'telegram-worker',
            modules: true,
            script: 'export default { fetch: () => new Response(JSON.stringify({success: true})) }'
          }
        ]
      }
    }),
  ],
  test: {
    pool: '@cloudflare/vitest-pool-workers',
    include: ['tests/integration/**/*.test.ts'],
  },
});