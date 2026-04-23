"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Terminal, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const REQUIRED_SECRETS = [
  { worker: "hoox", secret: "WEBHOOK_API_KEY_BINDING", desc: "For TradingView/External webhooks" },
  { worker: "trade-worker", secret: "API_SERVICE_KEY", desc: "Internal Auth Key" },
  { worker: "trade-worker", secret: "BINANCE_API_KEY", desc: "Binance Exchange API" },
  { worker: "trade-worker", secret: "BINANCE_API_SECRET", desc: "Binance Exchange Secret" },
  { worker: "telegram-worker", secret: "TELEGRAM_BOT_TOKEN", desc: "Telegram Bot Token" },
  { worker: "d1-worker", secret: "D1_INTERNAL_KEY", desc: "Internal Auth Key" },
  { worker: "agent-worker", secret: "AGENT_INTERNAL_KEY", desc: "Internal Auth Key" },
  { worker: "agent-worker", secret: "openai_key", desc: "OpenAI API Key" },
];

export function SetupChecklist() {
  const [housekeeping, setHousekeeping] = useState<any>(null);
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

  useEffect(() => {
    runCheck();
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
          <CardTitle>Required Secrets</CardTitle>
          <CardDescription>Run these commands in your CLI to configure missing secrets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <div className="space-y-0 divide-y divide-border border border-border rounded-md">
            {REQUIRED_SECRETS.map((req, i) => (
              <div key={i} className="p-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <span className="font-medium text-sm">{req.secret}</span>
                  <Badge variant="secondary" className="w-fit">{req.worker}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-2">{req.desc}</p>
                <div className="bg-secondary/50 p-2 rounded-md flex items-center gap-2 overflow-x-auto">
                  <Terminal className="h-3 w-3 text-muted-foreground shrink-0" />
                  <code className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                    bun run scripts/manage.ts secrets update-cf {req.secret} {req.worker}
                  </code>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
