// Simple production server for self-hosted Hoox
// Maps incoming requests to the appropriate worker based on the hostname/path

const DIST_DIR = "./dist";

const routes = {
  "hoox": "./dist/hoox/index.js",
  "trade-worker": "./dist/trade-worker/index.js",
  "telegram-worker": "./dist/telegram-worker/index.js",
  "d1-worker": "./dist/d1-worker/index.js",
  "agent-worker": "./dist/agent-worker/index.js",
  "web3-wallet-worker": "./dist/web3-wallet-worker/index.js",
};

const modules = {};

// Security headers applied to all responses
const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Permissions-Policy": "accelerometer=(), camera=(), geolocation=(), microphone=()",
  "Content-Security-Policy": "default-src 'self'",
};

function addSecurityHeaders(response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function loadWorker(name, path) {
  try {
    const module = await import(path);
    return module.default || module;
  } catch (e) {
    console.error(`Failed to load worker ${name}:`, e.message);
    return null;
  }
}

async function start() {
  console.log("🔥 Hoox Self-Hosted Runtime");
  console.log("Loading workers...");

  // Validate that an API key is configured for the self-hosted server
  const serverApiKey = process.env.HOOX_SERVER_API_KEY;
  if (!serverApiKey) {
    console.warn("⚠️  WARNING: HOOX_SERVER_API_KEY not set. The server has no authentication!");
    console.warn("   Set HOOX_SERVER_API_KEY environment variable for production use.");
  }

  for (const [name, path] of Object.entries(routes)) {
    const worker = await loadWorker(name, path);
    if (worker) {
      modules[name] = worker;
      console.log(`✅ Loaded ${name}`);
    }
  }

  const port = parseInt(process.env.PORT || "8080");

  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);

      // Health check endpoint (unauthenticated)
      if (url.pathname === "/healthz") {
        return new Response(JSON.stringify({ status: "ok" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      // API key validation for all other routes (if configured)
      if (serverApiKey) {
        const providedKey = req.headers.get("X-API-Key") || url.searchParams.get("apiKey");
        if (providedKey !== serverApiKey) {
          return addSecurityHeaders(
            new Response(JSON.stringify({ error: "Unauthorized" }), {
              status: 401,
              headers: { "Content-Type": "application/json" },
            })
          );
        }
      }

      let response;

      // Simple routing based on path
      // In a real workerd setup, this would be handled by service bindings
      if (url.pathname.startsWith("/telegram")) {
        response = modules["telegram-worker"]?.fetch(req) || new Response("Worker not loaded", { status: 500 });
      } else if (url.pathname.startsWith("/api/dashboard")) {
        response = modules["d1-worker"]?.fetch(req) || new Response("Worker not loaded", { status: 500 });
      } else {
        // Default to hoox gateway
        response = modules["hoox"]?.fetch(req) || new Response("Gateway not loaded", { status: 500 });
      }

      // Await if promise, then add security headers
      const resolvedResponse = await response;
      return addSecurityHeaders(resolvedResponse);
    }
  });

  console.log(`🚀 Hoox running on http://localhost:${port}`);
}

start();