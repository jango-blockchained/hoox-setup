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
      <body class="bg-[#000000] text-gray-100 min-h-screen">
        <nav class="bg-[#0f0f0f] border-b border-neutral-800 p-4 sticky top-0 z-50">
          <div class="container mx-auto flex justify-between items-center px-2">
            <div class="flex items-center gap-4">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f38020" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17.5 19c-2.5 0-4-1.5-4-4s1.5-4 4-4 4 1.5 4 4-1.5 4-4 4z"></path>
                <path d="M10 16.5c-2.5 0-4-1.5-4-4s1.5-4 4-4 4 1.5 4 4-1.5 4-4 4z"></path>
                <path d="M17.5 11c-2.5 0-4-1.5-4-4s1.5-4 4-4 4 1.5 4 4-1.5 4-4 4z"></path>
              </svg>
              <h1 class="text-sm font-semibold text-neutral-300">
                Workers &amp; Pages <span class="text-neutral-500 mx-2">›</span> <span class="text-white">hoox</span>
              </h1>
            </div>
            <div class="flex items-center gap-3">
              <button class="bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium py-1.5 px-3 rounded border border-neutral-700 transition-colors">
                &lt;/&gt; Edit code
              </button>
              <button class="bg-[#0051c3] hover:bg-[#0046a6] text-white text-xs font-medium py-1.5 px-3 rounded transition-colors flex items-center gap-1">
                Visit <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="7" y1="17" x2="17" y2="7"></line><polyline points="7 7 17 7 17 17"></polyline></svg>
              </button>
            </div>
          </div>
          <div class="container mx-auto px-2 mt-4 flex gap-6 text-sm text-neutral-400 border-b border-neutral-800 pb-0">
            <a href="#" class="pb-3 border-b-2 border-orange-500 text-white font-medium">Overview</a>
            <a href="#" class="pb-3 hover:text-neutral-200 transition-colors">Metrics</a>
            <a href="#" class="pb-3 hover:text-neutral-200 transition-colors">Deployments</a>
            <a href="#" class="pb-3 hover:text-neutral-200 transition-colors">Bindings</a>
            <a href="#" class="pb-3 hover:text-neutral-200 transition-colors">Observability</a>
            <a href="#" class="pb-3 hover:text-neutral-200 transition-colors">Settings</a>
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
          <div class="bg-[#0f0f0f] rounded-lg border border-neutral-800 p-6">
            <h2 class="text-sm font-semibold mb-4 text-white uppercase tracking-wide">Metrics <span class="text-neutral-500 font-normal normal-case ml-2 bg-neutral-800 px-2 py-0.5 rounded text-xs">Last 24 hours</span></h2>
            
            {error && (
              <div class="bg-red-950 border border-red-900 text-red-200 px-4 py-3 rounded text-sm mb-4">
                <strong class="font-bold">Error: </strong>
                <span>{error}</span>
              </div>
            )}
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-0 border-y border-neutral-800 py-4 mb-8">
              <div class="px-4 border-r border-neutral-800">
                <h3 class="text-xs text-neutral-400 font-medium">Requests (Total Trades)</h3>
                <p class="text-2xl font-semibold text-white mt-1">{stats.totalTrades}</p>
                <p class="text-xs text-blue-500 mt-2 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                  100%
                </p>
              </div>
              
              <div class="px-4 border-r border-neutral-800">
                <h3 class="text-xs text-neutral-400 font-medium">Errors</h3>
                <p class="text-2xl font-semibold text-white mt-1">0</p>
              </div>

              <div class="px-4">
                <h3 class="text-xs text-neutral-400 font-medium">Open Positions</h3>
                <p class="text-2xl font-semibold text-white mt-1">{stats.openPositions}</p>
                <p class="text-xs text-blue-500 mt-2 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                  Active
                </p>
              </div>
            </div>
            
            <div>
              <h3 class="text-sm font-semibold mb-4 text-white flex justify-between items-center">
                Versions (Recent Activity)
                <span class="text-neutral-500 cursor-pointer hover:text-white transition-colors">→</span>
              </h3>
              <div class="overflow-x-auto rounded border border-neutral-800">
                <table class="min-w-full bg-[#0f0f0f] border-collapse">
                  <tbody class="divide-y divide-neutral-800">
                    {recentActivity.length > 0 ? recentActivity.map((activity: any) => (
                      <tr class="hover:bg-neutral-900 transition-colors">
                        <td class="py-3 px-4 text-sm text-blue-400 font-mono">
                          {activity.id ? activity.id.substring(0, 8) : '--------'} <span class="text-neutral-500">📄</span>
                        </td>
                        <td class="py-3 px-4 text-sm text-neutral-300 italic">{activity.symbol || activity.asset || 'UNKNOWN'} - {(activity.action || activity.side) === 'BUY' || (activity.action || activity.side) === 'LONG' ? 'Long' : 'Short'}</td>
                        <td class="py-3 px-4 text-sm text-neutral-400">Wrangler <span class="text-neutral-500">by hoox</span></td>
                        <td class="py-3 px-4 text-sm text-neutral-400 text-right">{new Date(activity.timestamp || Date.now()).toLocaleTimeString()}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td class="py-4 px-4 text-sm text-neutral-500 text-center" colSpan={4}>No recent activity found.</td>
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
          <div class="bg-[#0f0f0f] rounded-lg border border-neutral-800 p-0 overflow-hidden">
            <div class="p-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900">
              <h2 class="text-sm font-semibold text-white">Bindings <span class="bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded ml-2 text-xs">7</span></h2>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
            </div>
            
            <div class="p-0">
              <div class="flex justify-between items-center p-3 text-xs text-neutral-400 border-b border-neutral-800 hover:bg-neutral-900">
                <span>Add a binding</span>
                <span class="text-lg leading-none font-thin cursor-pointer hover:text-white">+</span>
              </div>
              
              <div class="p-3 border-b border-neutral-800">
                <div class="text-xs text-neutral-400 mb-2">Workers AI</div>
                <div class="flex items-center text-sm text-neutral-300">
                  <span class="font-mono text-xs w-28">AI</span>
                  <span class="text-neutral-600 mx-2">→</span>
                  <span class="flex items-center gap-1 text-xs"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg> Workers AI</span>
                </div>
              </div>
              
              <div class="p-3 border-b border-neutral-800">
                <div class="text-xs text-neutral-400 mb-2">KV namespace</div>
                <div class="flex items-center text-sm text-neutral-300">
                  <span class="font-mono text-xs w-28">SESSIONS_KV</span>
                  <span class="text-neutral-600 mx-2">→</span>
                  <span class="flex items-center gap-1 text-xs"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect></svg> SESSIONS_KV</span>
                </div>
              </div>
              
              <div class="p-3">
                <div class="text-xs text-neutral-400 mb-2">Service binding</div>
                <div class="flex flex-col gap-2">
                  <div class="flex items-center text-sm text-neutral-300">
                    <span class="font-mono text-xs w-28">TELEGRAM_SER...</span>
                    <span class="text-neutral-600 mx-2">→</span>
                    <span class="flex items-center gap-1 text-xs"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg> telegram-worker</span>
                  </div>
                  <div class="flex items-center text-sm text-neutral-300">
                    <span class="font-mono text-xs w-28">TRADE_SERVICE</span>
                    <span class="text-neutral-600 mx-2">→</span>
                    <span class="flex items-center gap-1 text-xs"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg> trade-worker</span>
                  </div>
                  <div class="flex items-center text-sm text-neutral-300">
                    <span class="font-mono text-xs w-28">D1_SERVICE</span>
                    <span class="text-neutral-600 mx-2">→</span>
                    <span class="flex items-center gap-1 text-xs"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg> d1-worker</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-[#0f0f0f] rounded-lg border border-neutral-800 p-0 overflow-hidden">
            <div class="p-4 border-b border-neutral-800 flex justify-between items-center">
              <h2 class="text-sm font-semibold text-white">Domains &amp; Routes</h2>
              <span class="text-neutral-500 cursor-pointer hover:text-white transition-colors">→</span>
            </div>
            <div class="p-4 border-b border-neutral-800">
              <div class="text-xs text-neutral-400 mb-1">workers.dev</div>
              <div class="text-sm text-blue-400 hover:underline cursor-pointer">hoox.cryptolinx.workers.dev</div>
            </div>
            <div class="p-4 border-b border-neutral-800">
              <div class="text-xs text-neutral-400 mb-1">Custom domains</div>
              <div class="text-sm text-neutral-500">—</div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
});

export default app;
