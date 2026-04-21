import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { DEFAULT_SCHEMA } from './config';
import { loadSettingsPageConfig, renderFieldInput, parseSettingsFormData, validateJsonField } from './configLoader';

// Define the environment variables bindings
export interface Env {
  D1_SERVICE: Fetcher;
  TRADE_SERVICE: Fetcher;
  TELEGRAM_SERVICE: Fetcher;
  AGENT_SERVICE: Fetcher;
  CONFIG_KV: KVNamespace;
  DASHBOARD_USER?: string;
  DASHBOARD_PASS?: string;
}

const app = new Hono<{ Bindings: Env }>();

// Basic Auth Middleware
app.use('*', async (c, next) => {
  const username = c.env.DASHBOARD_USER || 'admin';
  const password = c.env.DASHBOARD_PASS || 'hoox123';
  
  const auth = basicAuth({
    username,
    password,
  });
  
  return auth(c, next);
});

// A simple layout component
const Layout = (props: { title: string; activeTab: string; children: any }) => {
  return (
    <html>
      <head>
        <title>{props.title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script src="https://cdn.tailwindcss.com"></script>
        <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
            <a href="/" class={`pb-3 ${props.activeTab === 'overview' ? 'border-b-2 border-orange-500 text-white font-medium' : 'hover:text-neutral-200 transition-colors'}`}>Overview</a>
            <a href="/positions" class={`pb-3 ${props.activeTab === 'positions' ? 'border-b-2 border-orange-500 text-white font-medium' : 'hover:text-neutral-200 transition-colors'}`}>Positions</a>
            <a href="/logs" class={`pb-3 ${props.activeTab === 'logs' ? 'border-b-2 border-orange-500 text-white font-medium' : 'hover:text-neutral-200 transition-colors'}`}>Logs</a>
            <a href="/settings" class={`pb-3 ${props.activeTab === 'settings' ? 'border-b-2 border-orange-500 text-white font-medium' : 'hover:text-neutral-200 transition-colors'}`}>Settings</a>
          </div>
        </nav>
        <main class="container mx-auto p-4 mt-6">
          {props.children}
        </main>
      </body>
    </html>
  );
};

// --- ROUTES ---

app.get('/', async (c) => {
  let stats = { totalTrades: 0, openPositions: 0 };
  let error = null;
  let recentActivity = [];
  let aiSummary = "Waiting for AI observation...";

  try {
    if (c.env.CONFIG_KV) {
       aiSummary = await c.env.CONFIG_KV.get('dashboard:ai_health_summary') || aiSummary;
    }

    if (c.env.D1_SERVICE) {
      const statsRes = await c.env.D1_SERVICE.fetch(new Request('http://d1-service/api/dashboard/stats'));
      if (statsRes.ok) {
         const data = await statsRes.json() as any;
         if (data.success) {
            stats = data.stats;
            recentActivity = data.recentActivity;
         }
      }
    }
  } catch (err) {
    error = "Could not connect to database or tables are missing: " + String(err);
  }

  return c.html(
    <Layout title="Dashboard - Overview" activeTab="overview">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Stats & Activity */}
        <div class="lg:col-span-2 space-y-6">
          <div class="bg-[#0f0f0f] rounded-lg border border-neutral-800 p-6">
            <h2 class="text-sm font-semibold mb-4 text-white uppercase tracking-wide">Metrics <span class="text-neutral-500 font-normal normal-case ml-2 bg-neutral-800 px-2 py-0.5 rounded text-xs">Overall</span></h2>
            
            {error && (
              <div class="bg-red-950 border border-red-900 text-red-200 px-4 py-3 rounded text-sm mb-4">
                <strong class="font-bold">Error: </strong>
                <span>{error}</span>
              </div>
            )}
            
            <div class="mb-6 p-4 rounded border border-blue-900/50 bg-blue-950/20">
              <h3 class="text-xs text-blue-400 font-medium mb-1 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                AI System Health
              </h3>
              <p class="text-sm text-neutral-300 italic">{aiSummary}</p>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-0 border-y border-neutral-800 py-4 mb-8">
              <div class="px-4 border-r border-neutral-800">
                <h3 class="text-xs text-neutral-400 font-medium">Requests (Total Trades)</h3>
                <p class="text-2xl font-semibold text-white mt-1">{stats.totalTrades}</p>
                <p class="text-xs text-blue-500 mt-2 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>
                  Lifetime
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

            {/* Performance Chart Placeholder */}
            <div class="mb-8 border border-neutral-800 rounded bg-[#0f0f0f] p-4">
              <h3 class="text-sm font-semibold text-white mb-4">Cumulative PnL (Mocked)</h3>
              <div class="relative h-48 w-full">
                <canvas id="pnlChart"></canvas>
              </div>
              <script dangerouslySetInnerHTML={{ __html: `
                document.addEventListener('DOMContentLoaded', function() {
                  const ctx = document.getElementById('pnlChart').getContext('2d');
                  new Chart(ctx, {
                    type: 'line',
                    data: {
                      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                      datasets: [{
                        label: 'PnL ($)',
                        data: [0, 150, -50, 300, 250, 600, 850],
                        borderColor: '#f38020',
                        backgroundColor: 'rgba(243, 128, 32, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                      }]
                    },
                    options: {
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        y: { grid: { color: '#262626' }, ticks: { color: '#a3a3a3' } },
                        x: { grid: { display: false }, ticks: { color: '#a3a3a3' } }
                      }
                    }
                  });
                });
              `}} />
            </div>
            
            <div>
              <h3 class="text-sm font-semibold mb-4 text-white flex justify-between items-center">
                Versions (Recent Activity)
                <a href="/logs" class="text-neutral-500 cursor-pointer hover:text-white transition-colors">→</a>
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
                        <td class="py-3 px-4 text-sm text-neutral-400 text-right">{new Date(activity.timestamp * 1000 || Date.now()).toLocaleTimeString()}</td>
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
              <h2 class="text-sm font-semibold text-white">Hoox Framework <span class="bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded ml-2 text-xs">7 Services</span></h2>
            </div>
            
            <div class="p-0">
              <div class="p-4 text-xs text-neutral-400 border-b border-neutral-800 leading-relaxed">
                Hoox is a modular, high-performance algorithmic trading and automation framework built entirely on Cloudflare Workers. It uses distributed microservices to process signals, execute trades, and manage state with near-zero latency worldwide.
              </div>
              
              <div class="p-3 border-b border-neutral-800">
                <div class="text-xs text-neutral-400 mb-2">Gateway</div>
                <div class="flex items-center text-sm text-neutral-300">
                  <span class="font-mono text-xs w-24">hoox</span>
                  <span class="text-neutral-600 mx-2">→</span>
                  <span class="flex items-center gap-1 text-xs">Webhook Receiver</span>
                </div>
              </div>
              
              <div class="p-3 border-b border-neutral-800">
                <div class="text-xs text-neutral-400 mb-2">Execution</div>
                <div class="flex items-center text-sm text-neutral-300">
                  <span class="font-mono text-xs w-24 text-green-400">trade-worker</span>
                  <span class="text-neutral-600 mx-2">→</span>
                  <span class="flex items-center gap-1 text-xs">Trading Engine</span>
                </div>
              </div>

              <div class="p-3 border-b border-neutral-800">
                <div class="text-xs text-neutral-400 mb-2">Storage</div>
                <div class="flex items-center text-sm text-neutral-300">
                  <span class="font-mono text-xs w-24 text-purple-400">d1-worker</span>
                  <span class="text-neutral-600 mx-2">→</span>
                  <span class="flex items-center gap-1 text-xs">Database Operations</span>
                </div>
              </div>
              
              <div class="p-3">
                <div class="text-xs text-neutral-400 mb-2">Ancillary Services</div>
                <div class="flex flex-col gap-2">
                  <div class="flex items-center text-sm text-neutral-300">
                    <span class="font-mono text-xs w-28 text-blue-400">telegram-worker</span>
                    <span class="text-neutral-600 mx-2">→</span>
                    <span class="flex items-center gap-1 text-xs">AI & Notifications</span>
                  </div>
                  <div class="flex items-center text-sm text-neutral-300">
                    <span class="font-mono text-xs w-28 text-yellow-400">web3-wallet</span>
                    <span class="text-neutral-600 mx-2">→</span>
                    <span class="flex items-center gap-1 text-xs">On-Chain DEX</span>
                  </div>
                  <div class="flex items-center text-sm text-neutral-300">
                    <span class="font-mono text-xs w-28 text-teal-400">home-assistant</span>
                    <span class="text-neutral-600 mx-2">→</span>
                    <span class="flex items-center gap-1 text-xs">Local Control</span>
                  </div>
                  <div class="flex items-center text-sm text-neutral-300">
                    <span class="font-mono text-xs w-28 text-pink-400">email-worker</span>
                    <span class="text-neutral-600 mx-2">→</span>
                    <span class="flex items-center gap-1 text-xs">IMAP Signals</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
});

// --- Settings Page (Schema-Based) ---
app.get('/settings', async (c) => {
  const services = {
    D1_SERVICE: c.env.D1_SERVICE,
    TRADE_SERVICE: c.env.TRADE_SERVICE,
    TELEGRAM_SERVICE: c.env.TELEGRAM_SERVICE,
    AGENT_SERVICE: c.env.AGENT_SERVICE
  };
  
  const pageConfig = await loadSettingsPageConfig(c.env.CONFIG_KV, services, DEFAULT_SCHEMA);
  const { schema, loadedValues } = pageConfig;

  const sectionsHtml = schema.sections.map(section => {
    const fieldsHtml = section.fields.map(field => `
      <div>
        <label class="block text-sm text-neutral-400 mb-1">${field.label}</label>
        ${renderFieldInput(field, loadedValues[field.key])}
      </div>
    `).join('');
    
    return `
      <div>
        <h3 class="text-md font-semibold text-white mb-2">${section.icon || ''} ${section.title}</h3>
        ${section.description ? `<p class="text-xs text-neutral-500 mb-3">${section.description}</p>` : ''}
        <div class="bg-neutral-900/50 p-4 rounded border border-neutral-800 grid grid-cols-2 gap-4">
          ${fieldsHtml}
        </div>
      </div>
    `;
  }).join('');

  return c.html(
    <Layout title="Dashboard - Settings" activeTab="settings">
      <div class="bg-[#0f0f0f] rounded-lg border border-neutral-800 p-6 max-w-4xl mx-auto">
        <h2 class="text-xl font-bold mb-6 text-white border-b border-neutral-800 pb-2">Configuration & Settings</h2>
        <p class="text-sm text-neutral-500 mb-6">Manage global settings and worker configurations</p>
        
        <form method="post" action="/settings" class="space-y-8">
          ${sectionsHtml}

          <div class="flex justify-end pt-4">
            <button type="submit" class="bg-[#0051c3] hover:bg-[#0046a6] text-white px-6 py-2 rounded font-medium transition-colors">
              Save Configuration
            </button>
          </div>
        </form>
      </div>
    </Layout>
  );
});

app.post('/settings', async (c) => {
  const body = await c.req.parseBody() as Record<string, string>;
  
  if (c.env.CONFIG_KV) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(body)) {
      formData.append(key, value);
    }
    const updates = parseSettingsFormData(formData);
    
    for (const [key, value] of Object.entries(updates)) {
      if (key.startsWith('_')) continue;
      
      if (typeof value === 'object') {
        await c.env.CONFIG_KV.put(key, JSON.stringify(value));
      } else {
        await c.env.CONFIG_KV.put(key, String(value));
      }
    }
  }

  return c.redirect('/settings?saved=true');
});

// --- Positions Page ---
app.post('/positions/close', async (c) => {
  const body = await c.req.parseBody();
  const exchange = body.exchange as string;
  const symbol = body.symbol as string;
  const side = body.side as string;
  const size = parseFloat(body.size as string);

  if (c.env.TRADE_SERVICE) {
    const action = side === 'LONG' ? 'CLOSE_LONG' : 'CLOSE_SHORT';
    const payload = {
      exchange,
      symbol,
      action,
      quantity: size,
    };
    
    try {
      await c.env.TRADE_SERVICE.fetch(new Request('http://trade-worker/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }));
    } catch (err) {
      console.error("Failed to close position via TRADE_SERVICE:", err);
    }
  }

  return c.redirect('/positions');
});

app.get('/positions', async (c) => {
  let positions = [];
  let error = null;

  try {
    if (c.env.D1_SERVICE) {
      const res = await c.env.D1_SERVICE.fetch(new Request('http://d1-service/api/dashboard/positions'));
      if (res.ok) {
         const data = await res.json() as any;
         if (data.success) positions = data.positions;
      }
    }
  } catch (err) {
    error = String(err);
  }

  return c.html(
    <Layout title="Dashboard - Active Positions" activeTab="positions">
      <div class="bg-[#0f0f0f] rounded-lg border border-neutral-800 p-6">
        <h2 class="text-xl font-bold mb-4 text-white border-b border-neutral-800 pb-2">Active Positions</h2>
        
        {error && <div class="text-red-500 mb-4">{error}</div>}

        <div class="overflow-x-auto rounded border border-neutral-800">
          <table class="min-w-full bg-[#0f0f0f] border-collapse">
            <thead class="bg-neutral-900 border-b border-neutral-800">
              <tr>
                <th class="py-3 px-4 text-left text-xs font-semibold text-neutral-400 uppercase">Exchange</th>
                <th class="py-3 px-4 text-left text-xs font-semibold text-neutral-400 uppercase">Symbol</th>
                <th class="py-3 px-4 text-left text-xs font-semibold text-neutral-400 uppercase">Side</th>
                <th class="py-3 px-4 text-left text-xs font-semibold text-neutral-400 uppercase">Size</th>
                <th class="py-3 px-4 text-left text-xs font-semibold text-neutral-400 uppercase">Updated At</th>
                <th class="py-3 px-4 text-right text-xs font-semibold text-neutral-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-neutral-800">
              {positions.length > 0 ? positions.map((p: any) => (
                <tr class="hover:bg-neutral-900">
                  <td class="py-3 px-4 text-sm text-neutral-300 capitalize">{p.exchange}</td>
                  <td class="py-3 px-4 text-sm text-white font-medium">{p.symbol}</td>
                  <td class="py-3 px-4 text-sm">
                     <span class={`px-2 py-1 rounded text-xs font-bold ${p.side === 'LONG' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>{p.side}</span>
                  </td>
                  <td class="py-3 px-4 text-sm text-neutral-300">{p.size}</td>
                  <td class="py-3 px-4 text-sm text-neutral-500">{new Date(p.updated_at * 1000).toLocaleString()}</td>
                  <td class="py-3 px-4 text-right">
                     <form method="post" action="/positions/close">
                       <input type="hidden" name="exchange" value={p.exchange} />
                       <input type="hidden" name="symbol" value={p.symbol} />
                       <input type="hidden" name="side" value={p.side} />
                       <input type="hidden" name="size" value={p.size} />
                       <button type="submit" class="text-xs bg-red-950 text-red-400 border border-red-900 px-2 py-1 rounded hover:bg-red-900 transition">Close</button>
                     </form>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td class="py-6 px-4 text-sm text-neutral-500 text-center italic" colSpan={6}>No active positions.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
});

// --- Logs Page ---
app.get('/logs', async (c) => {
  let logs = [];
  try {
    if (c.env.D1_SERVICE) {
      const res = await c.env.D1_SERVICE.fetch(new Request('http://d1-service/api/dashboard/logs'));
      if (res.ok) {
         const data = await res.json() as any;
         if (data.success) logs = data.logs;
      }
    }
  } catch (err) {}

  return c.html(
    <Layout title="Dashboard - System Logs" activeTab="logs">
      <div class="bg-[#0f0f0f] rounded-lg border border-neutral-800 p-6">
        <h2 class="text-xl font-bold mb-4 text-white border-b border-neutral-800 pb-2">System Logs</h2>
        
        <div class="bg-black border border-neutral-800 rounded p-4 h-96 overflow-y-auto font-mono text-xs space-y-2">
           {logs.length > 0 ? logs.map((l: any) => (
             <div class="flex gap-4">
               <span class="text-neutral-500 whitespace-nowrap">[{new Date(l.timestamp * 1000).toISOString()}]</span>
               <span class={`font-bold w-12 ${l.level === 'ERROR' ? 'text-red-500' : l.level === 'WARN' ? 'text-yellow-500' : 'text-blue-500'}`}>{l.level}</span>
               <span class="text-neutral-400 w-24">[{l.service}]</span>
               <span class="text-neutral-300">{l.message}</span>
             </div>
           )) : (
             <div class="text-neutral-600 italic">No logs generated yet.</div>
           )}
        </div>
      </div>
    </Layout>
  );
});

export default app;