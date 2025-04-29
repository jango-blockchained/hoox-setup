# TASKPLAN

**Phase 1: Foundational Enhancements & KV Integration**

1.  **Project Audit & Standardization:**
    - [ ] **1.1:** Review each existing worker (`d1-worker`, `home-assistant-worker`, `telegram-worker`, `trade-worker`, `web3-wallet-worker`, `webhook-receiver`) to understand current functionality and identify immediate opportunities for improvement or integration.
    - [X] **1.2:** Ensure all workers use `wrangler.jsonc` (migrate from `.toml` if necessary).
    - [ ] **1.3:** Standardize `wrangler.jsonc` settings across all workers:
        *   [X] Set `compatibility_date` to `"2025-03-07"`.
        *   [X] Set `compatibility_flags` to `["nodejs_compat"]`.
        *   [X] Ensure `observability.enabled = true` and `observability.head_sampling_rate = 1`.
        *   [X] Ensure `main` points to the correct entry file (e.g., `src/index.ts`).
    - [X] **1.4:** Standardize `tsconfig.json` settings for TypeScript projects.
    - [X] **1.5:** Update `worker-configuration.d.ts` for all workers using `npm run cf-typegen` or equivalent.

2.  **Workers KV Integration (Configuration & Session Data):**
    - [X] **2.1:** Identify needs for simple key-value storage (e.g., storing user preferences for `telegram-worker`, simple session management for `webhook-receiver`). // Proceeding with example plan (CONFIG_KV, SESSIONS_KV)
    - [X] **2.2:** Create necessary KV namespaces via Wrangler:
        ```sh
        npx wrangler kv:namespace create CONFIG_KV
        npx wrangler kv:namespace create SESSIONS_KV
        ```
    - [X] **2.3:** Add KV bindings to the relevant `wrangler.jsonc` files:
        ```jsonc
        // Example for a worker needing config
        {
          // ... other config
          "kv_namespaces": [
            { "binding": "CONFIG_KV", "id": "<CONFIG_KV_ID>", "preview_id": "<CONFIG_KV_PREVIEW_ID>" }
          ]
        }
        // Example for a worker needing sessions
        {
          // ... other config
          "kv_namespaces": [
            { "binding": "SESSIONS_KV", "id": "<SESSIONS_KV_ID>", "preview_id": "<SESSIONS_KV_PREVIEW_ID>" }
          ]
        }
        ```
    - [X] **2.4:** Update corresponding `worker-configuration.d.ts` files.
    - [ ] **2.5:** Implement logic in workers to read/write configuration or session data using `env.CONFIG_KV` or `env.SESSIONS_KV`.
    - [ ] **2.6:** Add basic tests (e.g., using `wrangler dev` and `curl`) to verify KV interactions.

**Phase 2: Storage & Asynchronous Processing**

3.  **R2 Object Storage Integration (Files & Assets):**
    - [ ] **3.1:** Identify needs for object storage (e.g., storing generated reports from `trade-worker`, logs, user-uploaded media via `telegram-worker`).
    - [ ] **3.2:** Create necessary R2 buckets via Wrangler:
        ```sh
        npx wrangler r2 bucket create trade-reports
        npx wrangler r2 bucket user-uploads
        ```
    - [ ] **3.3:** Add R2 bindings to relevant `wrangler.jsonc` files:
        ```jsonc
        // Example for trade-worker
        {
          // ... other config
          "r2_buckets": [
            { "binding": "REPORTS_BUCKET", "bucket_name": "trade-reports" }
          ]
        }
        // Example for telegram-worker
        {
          // ... other config
          "r2_buckets": [
            { "binding": "UPLOADS_BUCKET", "bucket_name": "user-uploads" }
          ]
        }
        ```
    - [ ] **3.4:** Update corresponding `worker-configuration.d.ts` files.
    - [ ] **3.5:** Implement logic for uploading (`put`) and retrieving (`get`) objects. Consider using pre-signed URLs for direct client uploads/downloads where appropriate.
    - [ ] **3.6:** Implement error handling and potentially public access rules if needed.
    - [ ] **3.7:** Add tests for R2 upload and retrieval.

4.  **Queues Integration (Decoupling & Background Tasks):**
    - [ ] **4.1:** Identify tasks suitable for asynchronous processing (e.g., sending notifications after a trade in `trade-worker`, processing incoming webhooks in `webhook-receiver` without blocking the response, long-running tasks initiated by `telegram-worker`).
    - [ ] **4.2:** Create necessary Queues via Wrangler:
        ```sh
        npx wrangler queues create NOTIFICATION_QUEUE
        npx wrangler queues create WEBHOOK_PROCESSING_QUEUE
        ```
    - [ ] **4.3:** Configure **Producer** bindings in the workers sending tasks:
        ```jsonc
        // Example for trade-worker
        {
          // ... other config
          "queues": {
            "producers": [
              { "queue": "NOTIFICATION_QUEUE", "binding": "NOTIFICATION_QUEUE" }
            ]
          }
        }
        ```
    - [ ] **4.4:** Configure **Consumer** logic in workers (or create new dedicated consumer workers):
        *   Implement the `queue(batch, env)` export in the consumer worker's `index.ts`.
        *   Add consumer configuration to the consumer's `wrangler.jsonc`:
            ```jsonc
            // Example for a notification-consumer-worker
            {
              "name": "notification-consumer",
              "main": "src/index.ts",
              "compatibility_date": "2025-03-07",
              "compatibility_flags": ["nodejs_compat"],
              "observability": { "enabled": true, "head_sampling_rate": 1 },
              "queues": {
                "consumers": [
                  {
                    "queue": "NOTIFICATION_QUEUE",
                    "max_batch_size": 10,
                    "max_wait_time_ms": 5000,
                    "dead_letter_queue": "NOTIFICATION_DLQ" // Recommended
                  }
                ]
              }
              // Add bindings needed by the consumer (e.g., KV for API keys)
            }
            ```
    - [ ] **4.5:** Update `worker-configuration.d.ts` for both producers and consumers.
    - [ ] **4.6:** Implement message sending logic (`env.QUEUE_BINDING.send(...)`) in producers.
    - [ ] **4.7:** Implement message processing logic within the `queue` handler, including error handling and potential retries (`message.retry()`, `batch.retryAll()`).
    - [ ] **4.8:** Set up Dead Letter Queues (DLQs) for failed messages.
    - [ ] **4.9:** Test the end-to-end flow (producer -> queue -> consumer).

**Phase 3: Advanced Capabilities (AI, Workflows, Agents)**

5.  **Workers AI / LLM Integration (Intelligence):**
    - [ ] **5.1:** Identify areas for AI enhancement (e.g., natural language command parsing in `telegram-worker`, sentiment analysis on webhook data in `webhook-receiver`, summarizing reports in `trade-worker`).
    - [ ] **5.2:** Choose AI model/provider (Default to Workers AI).
    - [ ] **5.3 (Workers AI):**
        *   Add the AI binding to relevant `wrangler.jsonc`: `{ "bindings": [{ "type": "ai", "binding": "AI" }] }`
        *   Update `worker-configuration.d.ts`.
        *   Implement calls using `env.AI.run('@cf/meta/llama-3-8b-instruct', ...)` or other suitable models.
    - [ ] **5.4 (External LLM - e.g., OpenAI):**
        *   Install SDK: `npm install openai`
        *   Add secret: `npx wrangler secret put OPENAI_API_KEY`
        *   Update `wrangler.jsonc` to declare the secret var: `{ "vars": { "OPENAI_API_KEY": null } }` (value comes from secret)
        *   Update `worker-configuration.d.ts`.
        *   Implement logic using the SDK, initializing with `env.OPENAI_API_KEY`. Consider AI Gateway.
    - [ ] **5.5:** If structured output is needed, use `response_format: { type: 'json_object' }` or `json_schema`.
    - [ ] **5.6:** Implement prompt engineering, input sanitization, and error handling.
    - [ ] **5.7:** Test AI interactions.

6.  **Workflows Integration (Orchestration):**
    - [ ] **6.1:** Identify complex, multi-step processes (e.g., user onboarding involving multiple workers, trade execution requiring several checks and external API calls).
    - [ ] **6.2:** Create a new worker for the Workflow definition or add to an existing one.
    - [ ] **6.3:** Define the Workflow class extending `WorkflowEntrypoint<Env, Params>`. Implement the `run` method using `step.do`, `step.sleep`, retry logic, etc.
    - [ ] **6.4:** Add the Workflow binding to `wrangler.jsonc`:
        ```jsonc
        {
          // ... other config
          "workflows": [
            {
              "binding": "ONBOARDING_WORKFLOW",
              "class_name": "UserOnboardingWorkflow"
            }
          ]
        }
        ```
    - [ ] **6.5:** Update `worker-configuration.d.ts` for the workflow worker and any workers that trigger it.
    - [ ] **6.6:** Implement logic in triggering workers (e.g., `telegram-worker`) to start workflows: `await env.ONBOARDING_WORKFLOW.create({ id: ..., params: {...} })`.
    - [ ] **6.7:** Implement status checking logic if needed: `await env.ONBOARDING_WORKFLOW.get(instanceId).status()`.
    - [ ] **6.8:** Test workflow initiation, execution, and completion/failure modes.

7.  **Agents Integration (Stateful AI):**
    - [ ] **7.1:** Identify use cases for stateful, evolving AI (e.g., a persistent chatbot in `telegram-worker` that remembers context, an autonomous trading agent based on `trade-worker`).
    - [ ] **7.2:** Create a new worker dedicated to the Agent.
    - [ ] **7.3:** Define the Agent class extending `Agent<Env, StateType>`. Implement relevant handlers (`onRequest`, `onConnect`, `onMessage`, `processTask`, `evolve`, etc.).
    - [ ] **7.4:** Integrate AI logic (Task 5) within the agent methods.
    - [ ] **7.5:** Implement state management using `this.setState()` and potentially `this.sql` for the embedded SQLite database. Define `StateType`.
    - [ ] **7.6:** Add Durable Object binding and migration to `wrangler.jsonc`:
        ```jsonc
        {
          // ... other config
          "durable_objects": {
            "bindings": [ { "name": "CHAT_AGENT", "class_name": "ChatAgent" } ]
          },
          "migrations": [
            { "tag": "v1", "new_sqlite_classes": ["ChatAgent"] }
          ]
          // Add other bindings the Agent needs (AI, KV, etc.)
        }
        ```
    - [ ] **7.7:** Update `worker-configuration.d.ts`.
    - [ ] **7.8:** Implement interaction logic in the main worker `fetch` handler using `routeAgentRequest` (for WebSocket/HTTP routing) or `getAgentByName`.
    - [ ] **7.9:** Test agent creation, interaction (HTTP/WebSocket), state persistence, and AI capabilities.

**Phase 4: Advanced Integrations & Communication**

8.  **Browser Rendering Integration (Web Interaction):**
    - [ ] **8.1:** Identify tasks needing headless browsing (e.g., scraping dynamic websites for `trade-worker`, generating PDFs of invoices from `web3-wallet-worker`).
    - [ ] **8.2:** Install Puppeteer: `npm install @cloudflare/puppeteer`
    - [ ] **8.3:** Add the Browser binding to the relevant `wrangler.jsonc`:
        ```jsonc
        {
          // ... other config
          "browser": { "binding": "BROWSER" }
        }
        ```
    - [ ] **8.4:** Update `worker-configuration.d.ts`.
    - [ ] **8.5:** Implement browser interaction logic using `puppeteer.launch(env.BROWSER)`, `page.goto()`, `page.pdf()`, etc. Ensure `browser.close()`.
    - [ ] **8.6:** Add error handling for browser operations.
    - [ ] **8.7:** Test browser rendering tasks.

9.  **Inter-Worker Communication (Service Bindings):**
    - [ ] **9.1:** Map out required communication paths between workers (e.g., `telegram-worker` needs to call `trade-worker`).
    - [ ] **9.2:** Ensure each worker intended to be *called* is configured correctly in its `wrangler.jsonc` (has a `name`).
    - [ ] **9.3:** In the *calling* worker's `wrangler.jsonc`, add service bindings:
        ```jsonc
        // Example in telegram-worker's wrangler.jsonc
        {
          // ... other config
          "services": [
            { "binding": "TRADE_API", "service": "trade-worker" }, // Assumes trade-worker has name: "trade-worker"
            { "binding": "WEBHOOK_RECEIVER_API", "service": "webhook-receiver" }
          ]
        }
        ```
    - [ ] **9.4:** Update the calling worker's `worker-configuration.d.ts`.
    - [ ] **9.5:** Implement calls in the calling worker using `await env.TRADE_API.fetch(request)`. Pass necessary headers/body.
    - [ ] **9.6:** Test inter-worker communication paths.

**Phase 5: Testing & Deployment**

10. **Comprehensive Testing & Deployment Strategy:**
    - [ ] **10.1:** Implement unit and integration tests using `vitest` or similar, mocking bindings as needed.
    - [ ] **10.2:** Create `curl` command collections or simple client scripts for end-to-end testing of deployed services.
    - [ ] **10.3:** Set up a CI/CD pipeline (e.g., GitHub Actions) using `wrangler deploy` for automated deployments.
    - [ ] **10.4:** Manage secrets and environment variables securely across different environments (dev/prod) using Wrangler secrets and potentially environment-specific `wrangler.jsonc` configurations or vars.
    - [ ] **10.5:** Actively monitor logs and metrics via the Cloudflare dashboard. Set up alerts for critical errors or performance degradation.