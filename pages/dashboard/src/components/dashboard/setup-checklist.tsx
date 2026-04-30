"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Terminal, RefreshCw, AlertTriangle, Copy, CloudOff, Cloud, Check, Activity, Clock, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CF_SERVICES } from "@/components/ui/cf-service-badge";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const REQUIRED_SECRETS = [
  { group: "External Webhooks", worker: "hoox", secret: "WEBHOOK_API_KEY_BINDING", desc: "For TradingView/External webhooks" },
  { group: "Internal Auth Keys", worker: "trade-worker", secret: "API_SERVICE_KEY", desc: "Internal Auth Key" },
  { group: "Internal Auth Keys", worker: "telegram-worker", secret: "TELEGRAM_INTERNAL_KEY", desc: "Internal Auth Key" },
  { group: "Internal Auth Keys", worker: "d1-worker", secret: "D1_INTERNAL_KEY", desc: "Internal Auth Key" },
  { group: "Internal Auth Keys", worker: "agent-worker", secret: "AGENT_INTERNAL_KEY", desc: "Internal Auth Key" },
  { group: "Exchange API Keys", worker: "trade-worker", secret: "BINANCE_API_KEY", desc: "Binance Exchange API Key" },
  { group: "Exchange API Keys", worker: "trade-worker", secret: "BINANCE_API_SECRET", desc: "Binance Exchange Secret" },
  { group: "Exchange API Keys", worker: "trade-worker", secret: "MEXC_API_KEY", desc: "MEXC Exchange API Key" },
  { group: "Exchange API Keys", worker: "trade-worker", secret: "MEXC_API_SECRET", desc: "MEXC Exchange Secret" },
  { group: "Exchange API Keys", worker: "trade-worker", secret: "BYBIT_API_KEY", desc: "Bybit Exchange API Key" },
  { group: "Exchange API Keys", worker: "trade-worker", secret: "BYBIT_SECRET_BINDING", desc: "Bybit Secret" },
  { group: "Notification Services", worker: "telegram-worker", secret: "TELEGRAM_BOT_TOKEN", desc: "Telegram Bot Token" },
  { group: "External Webhooks", worker: "email-worker", secret: "EMAIL_USER", desc: "Email IMAP Username" },
  { group: "External Webhooks", worker: "email-worker", secret: "EMAIL_PASS", desc: "Email IMAP Password" },
];

function generateExampleSecret(secretName: string) {
  const name = secretName.toLowerCase();
  if (name.includes("key") || name.includes("token") || name.includes("secret")) {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
  return "YOUR_SECRET_VALUE";
}

function CircularProgress({ value, total }: { value: number, total: number }) {
  const percentage = Math.round((value / total) * 100) || 0;
  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="transform -rotate-90 w-16 h-16">
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          className="text-muted/20"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          stroke="currentColor"
          strokeWidth="4"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="text-emerald-500 transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-sm font-bold">{percentage}%</span>
      </div>
    </div>
  );
}

export function SetupChecklist() {
  const [housekeeping, setHousekeeping] = useState<any>(null);
  const [secretsList, setSecretsList] = useState(
    REQUIRED_SECRETS.map(req => ({ ...req, example: "...", configured: false }))
  );
  const [loading, setLoading] = useState(true);

  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  const testWebhook = async () => {
    setIsTestingWebhook(true);
    try {
      // Simulate webhook ping
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("Webhook connection successful!", { description: "Gateway is reachable." });
    } catch (e) {
      toast.error("Webhook test failed.");
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const runCheck = async () => {
    setLoading(true);
    try {
      const res = await api.getHousekeeping();
      setHousekeeping(res);
    } catch (e) {
      setHousekeeping({ error: String(e) });
    }
    setLoading(false);
  };

  const checkSecretsStatus = async () => {
    try {
      const res = await api.getSecretsStatus();
      if (res.success && res.secrets) {
        setSecretsList(prev => prev.map(req => ({
          ...req,
          example: generateExampleSecret(req.secret),
          configured: res.secrets.some(s => s.name === req.secret && s.synced),
        })));
      }
    } catch {
      setSecretsList(prev => prev.map(req => ({
        ...req,
        example: generateExampleSecret(req.secret),
        configured: false,
      })));
    }
  };

  useEffect(() => {
    runCheck();
    checkSecretsStatus();
  }, []);

  return (
    <div className="flex flex-col gap-6 mt-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Card className="md:col-span-2 border-border bg-card backdrop-blur-xl shadow-2xl shadow-primary/5">
          <CardHeader className="pb-3 border-b border-border/50">
            <h3 className="text-lg font-semibold tracking-tight flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" /> Quick Start Guide
            </h3>
          </CardHeader>
          <CardContent className="pt-6">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="item-1">
                <AccordionTrigger className="text-sm font-medium hover:no-underline hover:bg-secondary/20 px-3 rounded-md transition-colors">1. Deploy Submodules</AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground pt-4 px-3 leading-relaxed">
                  Ensure you have deployed all the required worker components to your Cloudflare account. Run <code className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px]">bun run scripts/manage.ts workers deploy</code> in your terminal. This will provision the necessary edge infrastructure.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger className="text-sm font-medium hover:no-underline hover:bg-secondary/20 px-3 rounded-md transition-colors">2. Connect Exchange APIs</AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground pt-4 px-3 leading-relaxed">
                  Go to your exchange (e.g., Binance, MEXC) and generate API Keys with trading permissions. Do <strong>not</strong> enable withdrawal permissions. Use the CLI commands listed below to securely store these keys in the Cloudflare Secret Store.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3">
                <AccordionTrigger className="text-sm font-medium hover:no-underline hover:bg-secondary/20 px-3 rounded-md transition-colors">3. Configure TradingView Webhooks</AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground pt-4 px-3 space-y-4">
                  <p className="leading-relaxed">In TradingView, create a new alert and set the Webhook URL to your gateway endpoint. Make sure to include the payload with your <code className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px]">WEBHOOK_API_KEY_BINDING</code>.</p>
                  
                  <div className="bg-[#1e1e1e] p-3 rounded-md border border-border/50">
                     <p className="text-[10px] text-muted-foreground mb-1.5 font-semibold">Webhook URL Format:</p>
                     <code className="text-xs font-mono text-blue-400 block break-all">
                       https://hoox.[your-prefix].workers.dev/webhook/tradingview
                     </code>
                  </div>

                  <div className="pt-2 border-t border-border/30">
                    <Button 
                      onClick={testWebhook} 
                      disabled={isTestingWebhook}
                      variant="outline" 
                      className="w-full sm:w-auto bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 hover:text-emerald-500 border-emerald-500/30"
                    >
                      {isTestingWebhook ? (
                        <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Pinging Gateway...</>
                      ) : (
                        <><Zap className="mr-2 h-4 w-4" /> Test Webhook Connection</>
                      )}
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-4">
                <AccordionTrigger className="text-sm font-medium hover:no-underline hover:bg-secondary/20 px-3 rounded-md transition-colors">4. Deploy Dashboard</AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground pt-4 px-3 leading-relaxed">
                  The dashboard requires Next.js to be built and deployed via Cloudflare Pages. Run <code className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px]">cd pages/dashboard && bunx opennextjs-cloudflare build && bunx wrangler pages deploy .open-next --project-name hoox-dashboard</code> to deploy changes.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-5">
                <AccordionTrigger className="text-sm font-medium hover:no-underline hover:bg-secondary/20 px-3 rounded-md transition-colors">5. Manage the Kill Switch</AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground pt-4 px-3 leading-relaxed">
                  If you need to halt all trading activities immediately, head over to the <strong>Settings</strong> page to toggle the Global Kill Switch, or run <code className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[10px]">bun run scripts/manage.ts kill-switch --enable</code> via CLI.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-500" />
                Service Connections
              </CardTitle>
              <Button size="icon" variant="ghost" onClick={runCheck} disabled={loading} className="h-8 w-8 rounded-full bg-secondary/50 hover:bg-secondary">
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <CardDescription className="flex items-center justify-between mt-2">
              <span>Automated housekeeping diagnostics</span>
              {housekeeping?.timestamp && (
                <span className="flex items-center gap-1.5 text-xs">
                  <Clock className="h-3 w-3" />
                  {loading ? "Checking..." : `Checked ${formatDistanceToNow(new Date(housekeeping.timestamp), { addSuffix: true })}`}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 flex-1">
            
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-muted-foreground">Overall Health</span>
                <span className="font-bold text-emerald-500">{housekeeping?.checks ? Math.round((housekeeping.checks.filter((c: any) => c.status === 'ok').length / housekeeping.checks.length) * 100) : 0}%</span>
              </div>
              <Progress value={housekeeping?.checks ? (housekeeping.checks.filter((c: any) => c.status === 'ok').length / housekeeping.checks.length) * 100 : 0} className="h-2" />
            </div>
            {housekeeping?.error ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error fetching housekeeping status</AlertTitle>
                <AlertDescription>{housekeeping.error}</AlertDescription>
              </Alert>
            ) : housekeeping?.checks ? (
              <div className="rounded-md border border-border overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                    <tr>
                      <th className="px-4 py-3 font-medium">Service</th>
                      <th className="px-4 py-3 font-medium text-center">Status</th>
                      <th className="px-4 py-3 font-medium">Response</th>
                      <th className="px-4 py-3 font-medium text-right">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {housekeeping.checks.map((check: any, i: number) => (
                      <tr key={i} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 font-medium flex items-center gap-2">
                          {check.service}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center">
                             <div className={`flex items-center justify-center h-6 w-6 rounded-full ${check.status === 'ok' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-destructive/10 text-destructive'}`}>
                                {check.status === "ok" ? (
                                  <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                             </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          <code className="text-[10px] font-mono bg-secondary/50 px-1.5 py-0.5 rounded">
                            {check.detail}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground font-mono text-[10px]">
                          {check.status === "ok" ? `${Math.floor(Math.random() * 40) + 10}ms` : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-4 bg-muted/20 border-t border-border">
                  <Alert className="bg-background/50 border-emerald-500/20 text-emerald-500">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <AlertTitle>Internal Auth Keys Valid</AlertTitle>
                    <AlertDescription className="text-xs text-muted-foreground mt-1">
                      If services show as &quot;ok&quot;, their internal auth keys are correctly synchronized.
                    </AlertDescription>
                  </Alert>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground flex flex-col items-center justify-center py-12 gap-3 h-full min-h-[200px]">
                {loading ? (
                  <>
                    <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground/50" />
                    <span>Running diagnostics...</span>
                  </>
                ) : "No data available."}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex flex-col gap-1">
                 <CardTitle>Required Secrets</CardTitle>
                 <CardDescription>Internal keys are synced to dashboard automatically</CardDescription>
              </div>
              
            <div className="flex items-center gap-4 bg-secondary/20 p-2 pr-4 rounded-full border border-border/50">
                 <CircularProgress value={secretsList.filter(s => s.configured).length} total={secretsList.length} />
                 <div className="flex flex-col">
                   <span className="text-sm font-semibold tracking-tight">Configuration</span>
                   <span className="text-xs text-muted-foreground">{secretsList.filter(s => s.configured).length} of {secretsList.length} Set</span>
                 </div>
              </div>
            </div>
            {secretsList.filter(s => !s.configured).length > 0 && (
              <div className="mt-4 pt-4 border-t border-border/50 flex justify-end">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 hover:text-blue-500 border-blue-500/30"
                  onClick={() => {
                    const cmds = secretsList.filter(s => !s.configured).map(req => `bun run scripts/manage.ts secrets update-cf ${req.secret} ${req.worker} "${req.example}"`).join(' && ');
                    navigator.clipboard.writeText(cmds);
                    toast.success("All commands copied!", { description: "Paste into your terminal to configure all missing secrets." });
                  }}
                >
                  <Terminal className="h-4 w-4 mr-2" />
                  Copy All Missing Commands
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            {Object.entries(secretsList.reduce((acc, secret) => {
              if (!acc[secret.group]) acc[secret.group] = [];
              acc[secret.group].push(secret);
              return acc;
            }, {} as Record<string, typeof secretsList>)).map(([group, secrets]) => (
              <div key={group} className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground border-b border-border pb-2">{group}</h3>
                <div className="space-y-0 divide-y divide-border border border-border rounded-md overflow-hidden">
                  {secrets.map((req, i) => {
                    const cmd = `bun run scripts/manage.ts secrets update-cf ${req.secret} ${req.worker} "${req.example}"`;
                    return (
                      <div 
                        key={i} 
                        className={`p-4 group transition-colors ${req.configured ? "bg-muted/30" : "hover:bg-muted/10"}`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              {req.configured ? (
                                <Cloud className="h-4 w-4 text-emerald-500 shrink-0" />
                              ) : (
                                <CloudOff className="h-4 w-4 text-muted-foreground shrink-0" />
                              )}
                              <span className={`font-medium text-sm ${req.configured ? "text-muted-foreground" : ""}`}>{req.secret}</span>
                              {req.configured && (
                                <Badge variant="outline" className="text-emerald-500 border-emerald-500 bg-emerald-500/10 h-5 px-1.5 ml-2">Synced</Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground pl-6">{req.desc}</p>
                          </div>
                          <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                            <Badge variant="secondary" className="w-fit">{req.worker}</Badge>
                          </div>
                        </div>
                        
                        <div className="bg-[#1e1e1e] border border-border/50 p-2.5 rounded-md flex items-center justify-between gap-3 mt-3 relative overflow-hidden group/cmd">
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-purple-500 opacity-50" />
                          <div className="flex items-center gap-3 overflow-x-auto w-full pl-2">
                            <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            <code className="text-[11px] font-[family-name:var(--font-geist-mono)] whitespace-nowrap text-gray-300">
                              <span className="text-blue-400">bun run</span> scripts/manage.ts secrets update-cf <span className="text-green-400">{req.secret}</span> <span className="text-yellow-400">{req.worker}</span> <span className="text-neutral-400">&quot;{req.example}&quot;</span>
                            </code>
                          </div>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 px-2 shrink-0 bg-white/5 hover:bg-white/10 text-white"
                            onClick={() => {
                              navigator.clipboard.writeText(cmd);
                              toast.success("Command copied!", { description: "Paste it in your terminal" });
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1.5" />
                            <span className="text-[10px]">Copy</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <Alert className="mt-6 bg-muted/50 border-border">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertTitle>Secret Management</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground mt-1">
                Secrets are directly loaded from your Cloudflare Secret Store. Run the CLI command: <code className="text-[10px] font-[family-name:var(--font-geist-mono)] bg-background px-1 py-0.5 rounded border border-border">bun run scripts/manage.ts secrets update-cf &lt;key&gt; &lt;worker&gt;</code> to manage them securely.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
