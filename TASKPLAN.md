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
    - [X] **1.6:** Refactor duplicated KV timestamp logging logic into `src/utils/kvUtils.ts` and update workers (`home-assistant-worker`, `telegram-worker`, `trade-worker`).

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
    - [X] **2.5:** Implement logic in workers to read/write configuration or session data using `env.CONFIG_KV` or `env.SESSIONS_KV`.
    - [X] **2.6:** Add basic tests (e.g., using `wrangler dev` and `curl`) to verify KV interactions.

**Phase 2: Storage & Asynchronous Processing**

3.  **R2 Object Storage (S3-Compatible) Integration (Files & Assets):**
    - [X] **3.1:** Identify needs for object storage (e.g., storing generated reports from `trade-worker`, logs, user-uploaded media via `telegram-worker`). // Proceeding based on potential future needs
    - [X] **3.2:** Create necessary R2 buckets via Wrangler:
        ```sh
        npx wrangler r2 bucket create trade-reports
        npx wrangler r2 bucket create user-uploads
        ```
    - [X] **3.3:** Add R2 bindings to relevant `wrangler.jsonc` files:
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
    - [X] **3.4:** Update corresponding `worker-configuration.d.ts` files.
    - [-] **3.5:** Implement logic for uploading (`put`) and retrieving (`get`) objects. Consider using pre-signed URLs for direct client uploads/downloads where appropriate. // Deferred
    - [-] **3.6:** Implement error handling and potentially public access rules if needed. // Deferred
    - [-] **3.7:** Add tests for R2 upload and retrieval. // Deferred

4.  **Queues Integration (Decoupling & Background Tasks):**
    - [X] **4.1:** Identify tasks suitable for asynchronous processing (e.g., sending notifications after a trade in `trade-worker`, processing incoming webhooks in `webhook-receiver` without blocking the response, long-running tasks initiated by `telegram-worker`, external API calls in `home-assistant-worker`). // Added: Configurable enable/disable via KV.
    - [-] **4.2:** Create necessary Queues via Wrangler: // Deferred (Requires Queues enabled on Cloudflare account)
        ```sh
        npx wrangler queues create TRADE_NOTIFICATIONS_QUEUE
        npx wrangler queues create HA_COMMAND_QUEUE
        npx wrangler queues create TELEGRAM_OUTBOUND_QUEUE
        npx wrangler queues create WEBHOOK_PROCESSING_QUEUE
        ```
    - [-] **4.3:** Configure **Producer** bindings in the workers sending tasks: // Deferred
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
    - [-] **4.4:** Configure **Consumer** logic in workers (or create new dedicated consumer workers): // Deferred
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
    - [-] **4.5:** Update `worker-configuration.d.ts` for both producers and consumers. // Deferred
    - [-] **4.6:** Implement message sending logic (`env.QUEUE_BINDING.send(...)`) in producers. // Deferred (Include KV flag check)
    - [-] **4.7:** Implement message processing logic within the `queue` handler, including error handling and potential retries (`message.retry()`, `batch.retryAll()`). // Deferred
    - [-] **4.8:** Set up Dead Letter Queues (DLQs) for failed messages. // Deferred
    - [-] **4.9:** Test the end-to-end flow (producer -> queue -> consumer). // Deferred

**Phase 3: Advanced Capabilities (AI, RAG, Workflows, Agents)**

5.  **Vectorize Integration (Vector Database for RAG):**
    - [X] **5.1:** Identify RAG use cases and vector storage requirements (e.g., document search for `telegram-worker` Q&A, strategy docs for `trade-worker`, context lookup for `webhook-receiver`).
    - [X] **5.2:** Define Vectorize index dimensions and metric based on chosen embedding model (see Task 6). // Using 768 dimensions, cosine metric for @cf/baai/bge-base-en-v1.5
    - [X] **5.3:** Create Vectorize Index(es) via Wrangler:
        ```sh
        # Example using Workers AI built-in embedding model (@cf/baai/bge-base-en-v1.5)
        npx wrangler vectorize create my-rag-index --dimensions=768 --metric=cosine
        ```
    - [X] **5.4:** Add Vectorize bindings to relevant `wrangler.jsonc` files:
        ```jsonc
        {
          "vectorize": [
            { "binding": "VECTORIZE_INDEX", "index_name": "my-rag-index" }
          ]
        }
        ```
    - [X] **5.5:** Update corresponding `worker-configuration.d.ts` files.
    - [ ] **5.6:** Implement logic for generating embeddings (e.g., using `env.AI.run('@cf/baai/bge-base-en-v1.5', { text: [...] })`).
    - [ ] **5.7:** Implement logic for inserting embeddings and metadata into Vectorize (`env.VECTORIZE_INDEX.insert([{ id: ..., values: ..., metadata: ... }])`).
    - [ ] **5.8:** Implement logic for querying Vectorize (`env.VECTORIZE_INDEX.query(queryVector, { topK: 3 })`).
    - [ ] **5.9:** Test Vectorize insertion and querying.

6.  **Workers AI / LLM Integration (including RAG):**
    - [X] **6.1:** Identify areas for AI/LLM enhancement (e.g., RAG, basic Q&A, summarization, command parsing for `telegram-worker`, sentiment analysis for `webhook-receiver`).
    - [X] **6.2:** Choose AI model/provider (Default to Workers AI: `@cf/baai/bge-base-en-v1.5` for embeddings, `@cf/meta/llama-3-8b-instruct` for generation).
    - [ ] **6.3 (Workers AI - Basic):**
        *   [X] Add the AI binding to relevant `wrangler.jsonc` (`telegram-worker`, `trade-worker`, `webhook-receiver`).
        *   [X] Update `worker-configuration.d.ts`.
        *   [-] Implement basic calls using `env.AI.run('@cf/meta/llama-3-8b-instruct', ...)`. // Deferred
    - [-] **6.4 (External LLM - Basic):** // Deferred (Using Workers AI by default)
        *   Install SDK: `npm install openai` or similar.
        *   Add secret: `npx wrangler secret put <PROVIDER>_API_KEY`
        *   Update `wrangler.jsonc` vars: `{ "vars": { "<PROVIDER>_API_KEY": null } }`
        *   Update `worker-configuration.d.ts`.
        *   Implement basic logic using the SDK.
    - [-] **6.5 (RAG Implementation):** // Deferred (Depends on 5.6-5.8, 6.3c)
        *   Generate query embedding using an embedding model (Task 5.6).
        *   Query Vectorize to find relevant document chunks/IDs (Task 5.8).
        *   Retrieve corresponding full document text from source (e.g., R2 using IDs from Vectorize metadata).
        *   Construct augmented prompt including retrieved context.
        *   Call generation model (Task 6.3 / 6.4) with augmented prompt.
    - [-] **6.6:** If structured output is needed, use `response_format: { type: 'json_object' }` or `json_schema`. // Deferred
    - [-] **6.7:** Implement prompt engineering, input sanitization, and error handling for both basic and RAG calls. // Deferred
    - [-] **6.8:** Test basic AI calls and RAG pipeline functionality. // Deferred

7.  **Workflows Integration (Orchestration):**
    - [X] **7.1:** Identify complex, multi-step processes (e.g., user onboarding involving multiple workers, trade execution requiring several checks and external API calls).
    - [-] **7.2:** Create a new worker for the Workflow definition or add to an existing one. // Deferred
    - [-] **7.3:** Define the Workflow class extending `WorkflowEntrypoint<Env, Params>`. Implement the `run` method using `step.do`, `step.sleep`, retry logic, etc. // Deferred
    - [-] **7.4:** Add the Workflow binding to `wrangler.jsonc`: // Deferred
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
    - [-] **7.5:** Update `worker-configuration.d.ts` for the workflow worker and any workers that trigger it. // Deferred
    - [-] **7.6:** Implement logic in triggering workers (e.g., `telegram-worker`) to start workflows: `await env.ONBOARDING_WORKFLOW.create({ id: ..., params: {...} })`. // Deferred
    - [-] **7.7:** Implement status checking logic if needed: `await env.ONBOARDING_WORKFLOW.get(instanceId).status()`. // Deferred
    - [-] **7.8:** Test workflow initiation, execution, and completion/failure modes. // Deferred

8.  **Agents Integration (Stateful AI):**
    - [X] **8.1:** Identify use cases for stateful, evolving AI (e.g., a persistent chatbot in `telegram-worker`, an autonomous trading agent based on `trade-worker`).
    - [-] **8.2:** Create a new worker dedicated to the Agent. // Deferred
    - [-] **8.3:** Define the Agent class extending `Agent<Env, StateType>`. Implement relevant handlers (`onRequest`, `onConnect`, `onMessage`, `processTask`, `evolve`, etc.). // Deferred
    - [-] **8.4:** Integrate AI logic (Task 6) within the agent methods. // Deferred
    - [-] **8.5:** Implement state management using `this.setState()` and potentially `this.sql` for the embedded SQLite database. Define `StateType`. // Deferred
    - [-] **8.6:** Add Durable Object binding and migration to `wrangler.jsonc`: // Deferred
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
    - [-] **8.7:** Update `worker-configuration.d.ts`. // Deferred
    - [-] **8.8:** Implement interaction logic in the main worker `fetch` handler using `routeAgentRequest` (for WebSocket/HTTP routing) or `getAgentByName`. // Deferred
    - [-] **8.9:** Test agent creation, interaction (HTTP/WebSocket), state persistence, and AI capabilities. // Deferred

**Phase 4: Advanced Integrations & Communication**

9.  **Browser Rendering Integration (Web Interaction):**
    - [X] **9.1:** Identify tasks needing headless browsing (e.g., scraping dynamic websites for `trade-worker`, generating PDFs of invoices from `web3-wallet-worker`).
    - [X] **9.2:** Install Puppeteer: `npm install @cloudflare/puppeteer`
    - [X] **9.3:** Add the Browser binding to the relevant `wrangler.jsonc`:
        ```jsonc
        {
          // ... other config
          "browser": { "binding": "BROWSER" }
        }
        ```
    - [X] **9.4:** Update `worker-configuration.d.ts`.
    - [-] **9.5:** Implement browser interaction logic using `puppeteer.launch(env.BROWSER)`, `page.goto()`, `page.pdf()`, etc. Ensure `browser.close()`. // Deferred
    - [-] **9.6:** Add error handling for browser operations. // Deferred
    - [-] **9.7:** Test browser rendering tasks. // Deferred

10. **Inter-Worker Communication (Service Bindings):**
    - [X] **10.1:** Map out required communication paths: `telegram`->`trade`, `telegram`->`webhook`, `webhook`->`trade`, `webhook`->`telegram`, `trade`->`telegram`, `web3`->`telegram`.
    - [ ] **10.2:** Ensure each worker intended to be *called* is configured correctly in its `wrangler.jsonc` (has a `name`).
    - [ ] **10.3:** In the *calling* worker's `wrangler.jsonc`, add service bindings:
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
    - [ ] **10.4:** Update the calling worker's `worker-configuration.d.ts`.
    - [ ] **10.5:** Implement calls in the calling worker using `await env.TRADE_API.fetch(request)`. Pass necessary headers/body.
    - [-] **10.6:** Test inter-worker communication paths. // Deferred

**Phase 5: Testing & Deployment**

11. **Comprehensive Testing & Deployment Strategy:**
    - [-] **11.1:** Implement unit and integration tests using `vitest` or similar, mocking bindings as needed. // Deferred
    - [-] **11.2:** Create `curl` command collections or simple client scripts for end-to-end testing of deployed services. // Deferred
    - [-] **11.3:** Set up a CI/CD pipeline (e.g., GitHub Actions) using `wrangler deploy` for automated deployments. // Deferred
    - [-] **11.4:** Manage secrets and environment variables securely across different environments (dev/prod) using Wrangler secrets and potentially environment-specific `wrangler.jsonc` configurations or vars. // Deferred
    - [-] **11.5:** Actively monitor logs and metrics via the Cloudflare dashboard. Set up alerts for critical errors or performance degradation. // Deferred