# D1 Worker

**Last Updated:** April 2026

An example Cloudflare® Worker service demonstrating interaction with a Cloudflare® D1 database. In the main Hoox project, workers typically interact with D1 directly using bindings configured in their `wrangler.jsonc` files, but this serves as a standalone example.

## Features

- Demonstrates basic D1 database operations (querying, inserting).
- Uses parameterized queries for security.

## Prerequisites

- Node.js >= 16
- Bun
- Wrangler CLI
- Cloudflare® Workers account with D1 database access enabled.

## Setup

1. Install dependencies:
   ```bash
   bun install
   ```
2. Create a D1 database (if you haven't already):
   ```bash
   npx wrangler d1 create my-d1-database-example
   ```
3. Update `wrangler.jsonc` with your Cloudflare® Account ID and the D1 Database ID:
   ```jsonc
   {
     "name": "d1-worker-example",
     "main": "src/index.ts",
     "compatibility_date": "2025-03-07",
     "compatibility_flags": ["nodejs_compat"],
     "account_id": "YOUR_CLOUDFLARE_ACCOUNT_ID",
     "d1_databases": [
       {
         "binding": "DB",
         "database_name": "my-d1-database-example",
         "database_id": "YOUR_D1_DATABASE_ID",
       },
     ],
     "observability": {
       "enabled": true,
       "head_sampling_rate": 1,
     },
   }
   ```
4. Update the corresponding `worker-configuration.d.ts` file.
5. Create a schema file (e.g., `schema.sql`) and apply it:
   ```sql
   DROP TABLE IF EXISTS ExampleData;
   CREATE TABLE ExampleData (
       id INTEGER PRIMARY KEY AUTOINCREMENT,
       name TEXT NOT NULL,
       value REAL,
       timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```
   ```bash
   npx wrangler d1 execute my-d1-database-example --file=./schema.sql
   ```
6. For local development using a local D1 database, add `--local` to the `wrangler dev` command and run the `wrangler d1 execute` command with `--local` as well.
   ```bash
   # Apply schema locally
   npx wrangler d1 execute my-d1-database-example --file=./schema.sql --local
   # Run locally
   bun run dev --local
   ```

## Development

Run locally:

```bash
bun run dev --local
```

Deploy:

```bash
bun run deploy
```

## API Usage

This example worker might expose simple endpoints (e.g., `/`, `/insert`, `/list`) to demonstrate D1 interaction. Refer to the worker's source code (`src/index.ts`) for specific endpoints and expected request/response formats.

## Security

- Use parameterized queries (`env.DB.prepare(...)`) to prevent SQL injection.
- Avoid exposing sensitive database details in error messages.
- If exposing endpoints publicly, add authentication/authorization.

---

*Cloudflare® and the Cloudflare logo are trademarks and/or registered trademarks of Cloudflare, Inc. in the United States and other jurisdictions.*
