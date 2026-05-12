# Cloudflare Services Live Test Suite

This directory contains integration tests that exercise **real** Cloudflare services — no mocks, no stubs, no Miniflare simulacra.

## Prerequisites

1. **Cloudflare account** with the services under test provisioned
2. **wrangler CLI** installed and authenticated (`wrangler whoami`)
3. **Environment variables** set (copy `env.template` to `.env`)

## Setup

```bash
# Copy the environment template
cp tests/live/env.template tests/live/.env

# Edit tests/live/.env with your Cloudflare credentials
# All values are REQUIRED unless marked optional

# Run all live tests
bun test:live

# Run specific test files
bun test tests/live/d1.test.ts
bun test tests/live/kv.test.ts
bun test tests/live/r2.test.ts
bun test tests/live/queues.test.ts
bun test tests/live/ai.test.ts
bun test tests/live/api.test.ts
bun test tests/live/durable-objects.test.ts
bun test tests/live/secrets.test.ts
```

## What Gets Tested

| Test file | CF Service | What it does |
|-----------|-----------|--------------|
| `d1.test.ts` | D1 SQL Database | Execute queries, create/drop tables, insert/select rows, batch operations |
| `kv.test.ts` | KV Namespace | Put/get/delete key-value pairs, list keys, bulk operations |
| `r2.test.ts` | R2 Object Storage | Put/get/delete objects, list buckets, multipart upload |
| `queues.test.ts` | Queues | Send/receive messages, batch sends, queue lifecycle |
| `ai.test.ts` | Workers AI | Text generation, embeddings, text classification inference |
| `durable-objects.test.ts` | Durable Objects | DO class registration, counter/alarm operations (deploys test worker) |
| `secrets.test.ts` | Secrets | List/create/delete secrets via wrangler |
| `api.test.ts` | Cloudflare REST API | Account details, zone listing, user info |

## Safety

- Tests prefix all created resources with `live-test-{timestamp}` for easy cleanup
- Tests clean up after themselves (delete keys, objects, queues)
- If a test fails mid-way, run cleanup manually or via `wrangler` CLI
- Use a **development/staging account** — NOT production

## Architecture

```
tests/live/
├── env.template          # Environment variable template (copy to .env)
├── README.md             # This file
├── helpers.ts            # Shared wrangler & API wrappers, lifecycle utilities
├── d1.test.ts            # D1 SQL database tests
├── kv.test.ts            # KV namespace tests
├── r2.test.ts            # R2 object storage tests
├── queues.test.ts        # Queue messaging tests
├── ai.test.ts            # Workers AI inference tests
├── durable-objects.test.ts  # Durable Object tests
├── secrets.test.ts       # Secret management tests
└── api.test.ts           # Cloudflare REST API tests
```
