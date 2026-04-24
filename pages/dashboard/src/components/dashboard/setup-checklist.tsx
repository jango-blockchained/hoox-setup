"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Terminal, RefreshCw, AlertTriangle, Copy, CloudOff, Cloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { toast } from "sonner";

const REQUIRED_SECRETS = [
  { worker: "hoox", secret: "WEBHOOK_API_KEY_BINDING", desc: "For TradingView/External webhooks" },
  { worker: "trade-worker", secret: "API_SERVICE_KEY", desc: "Internal Auth Key" },
  { worker: "trade-worker", secret: "BINANCE_API_KEY", desc: "Binance Exchange API Key" },
  { worker: "trade-worker", secret: "BINANCE_API_SECRET", desc: "Binance Exchange Secret" },
  { worker: "trade-worker", secret: "MEXC_API_KEY", desc: "MEXC Exchange API Key" },
  { worker: "trade-worker", secret: "MEXC_API_SECRET", desc: "MEXC Exchange Secret" },
  { worker: "trade-worker", secret: "BYBIT_API_KEY", desc: "Bybit Exchange API Key" },
  { worker: "trade-worker", secret: "BYBIT_SECRET_BINDING", desc: "Bybit Secret" },
  { worker: "telegram-worker", secret: "TELEGRAM_BOT_TOKEN", desc: "Telegram Bot Token" },
  { worker: "telegram-worker", secret: "TELEGRAM_INTERNAL_KEY", desc: "Internal Auth Key" },
  { worker: "d1-worker", secret: "D1_INTERNAL_KEY", desc: "Internal Auth Key" },
  { worker: "agent-worker", secret: "AGENT_INTERNAL_KEY", desc: "Internal Auth Key" },
  { worker: "email-worker", secret: "EMAIL_USER", desc: "Email IMAP Username" },
  { worker: "email-worker", secret: "EMAIL_PASS", desc: "Email IMAP Password" },
];

const INTERNAL_KEY_SECRETS = [
  "API_SERVICE_KEY",
  "D1_INTERNAL_KEY",
  "AGENT_INTERNAL_KEY",
  "TELEGRAM_INTERNAL_KEY",
];

function generateExampleSecret(secretName: string) {
  const name = secretName.toLowerCase();
  if (name.includes("key") || name.includes("token") || name.includes("secret")) {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  }
  return "YOUR_SECRET_VALUE";
}

export function SetupChecklist() {
  const [housekeeping, setHousekeeping] = useState<any>(null);
  const [secretsList, setSecretsList] = useState(
    REQUIRED_SECRETS.map(req => ({ ...req, example: "...", configured: false }))
  );
  const [loading, setLoading] = useState(true);

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
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Service Connections
            <Button size="icon" variant="ghost" onClick={runCheck} disabled={loading} className="h-6 w-6">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </CardTitle>
          <CardDescription>Automated housekeeping checks from the Agent Worker</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {housekeeping?.error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error fetching housekeeping status</AlertTitle>
              <AlertDescription>{housekeeping.error}</AlertDescription>
            </Alert>
          ) : housekeeping?.checks ? (
            <div className="space-y-2">
              {housekeeping.checks.map((check: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 border border-border rounded-md">
                  <span className="font-medium text-sm">{check.service}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{check.detail}</span>
                    {check.status === "ok" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-destructive" />
                    )}
                  </div>
                </div>
              ))}
              <Alert className="mt-4 bg-muted/50">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <AlertTitle>Internal Auth Keys Valid</AlertTitle>
                <AlertDescription className="text-xs text-muted-foreground mt-1">
                  If D1, TRADE, and TELEGRAM services show as &quot;ok&quot;, it means their internal auth keys are correctly synchronized.
                </AlertDescription>
              </Alert>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground flex items-center justify-center py-8">
              {loading ? "Running checks..." : "No data available."}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Required Secrets</span>
            <Badge variant={secretsList.some(s => s.configured) ? "default" : "secondary"}>
              {secretsList.filter(s => s.configured).length}/{secretsList.length} configured
            </Badge>
          </CardTitle>
          <CardDescription>Internal keys are synced to dashboard automatically</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="space-y-0 divide-y divide-border border border-border rounded-md">
            {secretsList.map((req, i) => {
              const isInternalKey = INTERNAL_KEY_SECRETS.includes(req.secret);
              const cmd = `bun run scripts/manage.ts secrets update-cf ${req.secret} ${req.worker} "${req.example}"`;
              return (
                <div 
                  key={i} 
                  className={`p-3 group ${req.configured ? "bg-muted/30" : ""}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {req.configured ? (
                        <Cloud className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <CloudOff className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className={`font-medium text-sm ${req.configured ? "text-muted-foreground" : ""}`}>{req.secret}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {req.configured && (
                        <Badge variant="outline" className="text-emerald-500 border-emerald-500 bg-emerald-500/10">Synced</Badge>
                      )}
                      <Badge variant="secondary" className="w-fit">{req.worker}</Badge>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{req.desc}</p>
                  <div className="bg-secondary/50 p-2 rounded-md flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-x-auto">
                      <Terminal className={`h-3 w-3 shrink-0 ${req.configured ? "text-emerald-500/50" : "text-muted-foreground"}`} />
                      <code className={`text-xs font-mono whitespace-nowrap ${req.configured ? "text-muted-foreground/50" : "text-muted-foreground"}`}>
                        {cmd}
                      </code>
                    </div>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => {
                        navigator.clipboard.writeText(cmd);
                        toast.success("Command copied to clipboard");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
          <Alert className="mt-4 bg-muted/50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Internal Keys</AlertTitle>
            <AlertDescription className="text-xs text-muted-foreground mt-1">
              Internal keys (AGENT_INTERNAL_KEY, D1_INTERNAL_KEY, API_SERVICE_KEY) are automatically synced to the dashboard when you run the CLI command: <code className="text-xs">bun run secrets:update &lt;key&gt; &lt;worker&gt;</code>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
