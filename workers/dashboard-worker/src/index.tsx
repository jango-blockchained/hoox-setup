import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';

// Define the environment variables bindings
export interface Env {
  D1_SERVICE: Fetcher;
  DASHBOARD_USER?: string;
  DASHBOARD_PASS?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Basic Auth Middleware
app.use('*', async (c, next) => {
  // Try to use environment variables for credentials, fallback to defaults for testing
  const username = c.env.DASHBOARD_USER || 'admin';
  const password = c.env.DASHBOARD_PASS || 'hoox123';
  
  const auth = basicAuth({
    username,
    password,
  });
  
  return auth(c, next);
});

// A simple layout component
const Layout = (props: { title: string; children: any }) => {
  return (
    <html>
      <head>
        <title>{props.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          {`
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          `}
        </style>
      </head>
      <body class="bg-gray-900 text-gray-100 min-h-screen">
        <nav class="bg-gray-800 border-b-2 border-orange-500 p-4 shadow-md">
          <div class="container mx-auto flex justify-between items-center">
            <h1 class="text-xl font-bold text-white flex items-center gap-2">
              <span class="text-orange-500">⚡</span> Hoox Dashboard
            </h1>
            <div>
              <span class="text-sm text-gray-400">Secured Area</span>
            </div>
          </div>
        </nav>
        <main class="container mx-auto p-4 mt-6">
          {props.children}
        </main>
      </body>
    </html>
  );
};

app.get('/', async (c) => {
  let stats = { totalTrades: 0, openPositions: 0 };
  let error = null;
  
  // Try to fetch basic stats from D1 or Trade Worker
  let recentActivity = [];
  try {
    if (c.env.D1_SERVICE) {
      // Get total trades
      const tradesRes = await c.env.D1_SERVICE.fetch(new Request('http://d1-service/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT COUNT(*) as count FROM trades' })
      }));
      
      if (tradesRes.ok) {
        const tradesData = await tradesRes.json() as any;
        if (tradesData.success && tradesData.results && tradesData.results.length > 0) {
           stats.totalTrades = tradesData.results[0].count || 0;
        }
      }

      // Get open positions
      const posRes = await c.env.D1_SERVICE.fetch(new Request('http://d1-service/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: "SELECT COUNT(*) as count FROM positions WHERE status = 'open'" })
      }));

      if (posRes.ok) {
        const posData = await posRes.json() as any;
        if (posData.success && posData.results && posData.results.length > 0) {
           stats.openPositions = posData.results[0].count || 0;
        }
      }

      // Get recent activity
      const activityRes = await c.env.D1_SERVICE.fetch(new Request('http://d1-service/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'SELECT * FROM trades ORDER BY timestamp DESC LIMIT 10' })
      }));

      if (activityRes.ok) {
         const activityData = await activityRes.json() as any;
         if (activityData.success && activityData.results) {
            recentActivity = activityData.results;
         }
      }
    }
  } catch (err) {
    error = "Could not connect to database or tables are missing: " + String(err);
  }

  return c.html(
    <Layout title="Dashboard">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Stats & Activity */}
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
            <h2 class="text-2xl font-bold mb-4 text-white">Trading Overview</h2>
            
            {error && (
              <div class="bg-red-900 border border-red-500 text-red-100 px-4 py-3 rounded relative mb-4">
                <strong class="font-bold">Error: </strong>
                <span class="block sm:inline">{error}</span>
              </div>
            )}
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="bg-gray-700 p-4 rounded-lg border border-gray-600 shadow-inner">
                <h3 class="text-sm text-gray-400 font-semibold uppercase tracking-wider">Total Trades</h3>
                <p class="text-4xl font-bold text-white mt-2">{stats.totalTrades}</p>
              </div>
              
              <div class="bg-gray-700 p-4 rounded-lg border border-gray-600 shadow-inner">
                <h3 class="text-sm text-gray-400 font-semibold uppercase tracking-wider">Open Positions</h3>
                <p class="text-4xl font-bold text-orange-500 mt-2">{stats.openPositions}</p>
              </div>
            </div>
            
            <div class="mt-8">
              <h3 class="text-xl font-semibold mb-4 text-white border-b border-gray-700 pb-2">Recent Activity</h3>
              <div class="overflow-x-auto">
                <table class="min-w-full bg-gray-800 border-collapse">
                  <thead class="bg-gray-700 border-b border-gray-600">
                    <tr>
                      <th class="py-3 px-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Date</th>
                      <th class="py-3 px-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Symbol</th>
                      <th class="py-3 px-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Action</th>
                      <th class="py-3 px-4 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-700">
                    {recentActivity.length > 0 ? recentActivity.map((activity: any) => (
                      <tr class="hover:bg-gray-750 transition-colors">
                        <td class="py-3 px-4 text-sm text-gray-300">{new Date(activity.timestamp || Date.now()).toLocaleString()}</td>
                        <td class="py-3 px-4 text-sm text-white font-medium">{activity.symbol || activity.asset || 'UNKNOWN'}</td>
                        <td class="py-3 px-4 text-sm">
                          <span class={`px-2 py-1 rounded text-xs font-bold ${
                            (activity.action || activity.side) === 'BUY' || (activity.action || activity.side) === 'LONG' ? 'bg-green-900 text-green-300 border border-green-700' : 'bg-red-900 text-red-300 border border-red-700'
                          }`}>
                            {activity.action || activity.side || 'TRADE'}
                          </span>
                        </td>
                        <td class="py-3 px-4 text-sm text-gray-300">{activity.status || 'EXECUTED'}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td class="py-4 px-4 text-sm text-gray-500 text-center italic" colSpan={4}>No recent activity found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Framework Overview */}
        <div class="space-y-6">
          <div class="bg-gray-800 rounded-lg shadow-lg border border-gray-700 p-6">
            <h2 class="text-xl font-bold mb-4 text-white flex items-center gap-2 border-b border-gray-700 pb-2">
              <span class="text-blue-400">🌐</span> Hoox Framework
            </h2>
            <p class="text-sm text-gray-300 mb-6 leading-relaxed">
              Hoox is a modular, high-performance algorithmic trading and automation framework built entirely on Cloudflare Workers. It uses distributed microservices to process signals, execute trades, and manage state with near-zero latency worldwide.
            </p>
            
            <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Active Services</h3>
            <div class="space-y-3">
              <div class="p-3 bg-gray-700 rounded border-l-4 border-orange-500">
                <div class="font-bold text-white text-sm">🪝 hoox (Webhook Receiver)</div>
                <div class="text-xs text-gray-400 mt-1">Ingests signals from TradingView/external sources, validates IP/API keys, and routes them.</div>
              </div>
              <div class="p-3 bg-gray-700 rounded border-l-4 border-green-500">
                <div class="font-bold text-white text-sm">📈 trade-worker</div>
                <div class="text-xs text-gray-400 mt-1">Core execution engine. Parses signals, applies risk management, and forwards to exchanges via CCXT.</div>
              </div>
              <div class="p-3 bg-gray-700 rounded border-l-4 border-blue-500">
                <div class="font-bold text-white text-sm">💬 telegram-worker</div>
                <div class="text-xs text-gray-400 mt-1">AI-powered conversational bot (RAG + Vectorize). Handles notifications and natural language queries.</div>
              </div>
              <div class="p-3 bg-gray-700 rounded border-l-4 border-purple-500">
                <div class="font-bold text-white text-sm">💾 d1-worker</div>
                <div class="text-xs text-gray-400 mt-1">Database service wrapping Cloudflare D1. Manages trades, positions, and historical logs.</div>
              </div>
              <div class="p-3 bg-gray-700 rounded border-l-4 border-pink-500">
                <div class="font-bold text-white text-sm">✉️ email-worker</div>
                <div class="text-xs text-gray-400 mt-1">IMAP listener that scans for structured email signals and triggers trading logic.</div>
              </div>
              <div class="p-3 bg-gray-700 rounded border-l-4 border-teal-500">
                <div class="font-bold text-white text-sm">🏠 home-assistant-worker</div>
                <div class="text-xs text-gray-400 mt-1">Bridging logic to expose trading state and allow control via local Home Assistant instances.</div>
              </div>
              <div class="p-3 bg-gray-700 rounded border-l-4 border-yellow-500">
                <div class="font-bold text-white text-sm">🦊 web3-wallet-worker</div>
                <div class="text-xs text-gray-400 mt-1">On-chain interaction service for executing trades on DEXs and interacting with smart contracts.</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
});

export default app;
