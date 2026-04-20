// Simple production server for self-hosted Hoox
// Maps incoming requests to the appropriate worker based on the hostname/path

const DIST_DIR = "./dist";

const routes = {
  "hoox": "./dist/hoox/index.js",
  "trade-worker": "./dist/trade-worker/index.js",
  "telegram-worker": "./dist/telegram-worker/index.js",
  "d1-worker": "./dist/d1-worker/index.js",
  "agent-worker": "./dist/agent-worker/index.js",
  "dashboard-worker": "./dist/dashboard-worker/index.js",
  "web3-wallet-worker": "./dist/web3-wallet-worker/index.js",
};

const modules = {};

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
    fetch(req) {
      const url = new URL(req.url);
      const hostname = req.headers.get("host") || "";
      
      // Simple routing based on path
      // In a real workerd setup, this would be handled by service bindings
      if (url.pathname.startsWith("/telegram")) {
        return modules["telegram-worker"]?.fetch(req) || new Response("Worker not loaded", { status: 500 });
      }
      if (url.pathname.startsWith("/api/dashboard")) {
        return modules["d1-worker"]?.fetch(req) || new Response("Worker not loaded", { status: 500 });
      }
      
      // Default to hoox gateway
      return modules["hoox"]?.fetch(req) || new Response("Gateway not loaded", { status: 500 });
    }
  });

  console.log(`🚀 Hoox running on http://localhost:${port}`);
}

start();