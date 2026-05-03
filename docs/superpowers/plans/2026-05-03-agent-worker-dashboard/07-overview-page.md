### Task 7: Overview Page

**Files:**
- Create: `src/app/dashboard/agent/page.tsx`

- [ ] **Step 1: Create the Overview page**

```tsx
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Brain, Activity, Settings, Shield, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function AgentOverviewPage() {
  const [status, setStatus] = useState<{
    killSwitch?: boolean;
    config?: any;
    activeStops?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/agent/status");
      const data = await res.json();
      if (data.success) {
        setStatus(data.status);
      }
    } catch (e) {
      toast.error("Failed to fetch agent status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleKillSwitch = async (action: 'engage_kill_switch' | 'release_kill_switch') => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/agent/risk-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchStatus();
      } else {
        toast.error(data.error || "Action failed");
      }
    } catch (e) {
      toast.error("Failed to update kill switch");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Brain className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground">AI Agent</h1>
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const config = status?.config;

  return (
    <div className="flex flex-col gap-6">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <Brain className="h-8 w-8 text-primary" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">AI Agent</h1>
            <p className="text-sm text-muted-foreground">
              Monitor and control the AI trading agent
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading}>
          <RefreshCw className="h-4 w-4" data-icon="inline-start" />
          Refresh
        </Button>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <Badge variant={status?.killSwitch ? "destructive" : "default"}>
                    {status?.killSwitch ? "Kill Switch Active" : "Active"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Provider</span>
                  <span className="text-sm font-medium text-foreground">
                    {config?.defaultProvider || "workers-ai"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Active Stops</span>
                  <span className="text-sm font-medium text-foreground">
                    {status?.activeStops || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Button 
                  variant={status?.killSwitch ? "default" : "destructive"} 
                  className="w-full"
                  onClick={() => handleKillSwitch(status?.killSwitch ? 'release_kill_switch' : 'engage_kill_switch')}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <Spinner className="h-4 w-4" data-icon="inline-start" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Shield className="h-4 w-4" data-icon="inline-start" />
                      {status?.killSwitch ? "Release Kill Switch" : "Engage Kill Switch"}
                    </>
                  )}
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <a href="/dashboard/agent/models">
                    <Settings className="h-4 w-4" data-icon="inline-start" />
                    Configure Models
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-base">Configuration Summary</CardTitle>
            <CardDescription>Current agent configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Default Provider</span>
                <span className="text-sm font-medium">{config?.defaultProvider || "workers-ai"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Fallback Chain</span>
                <span className="text-sm font-medium">
                  {(config?.fallbackChain || ["workers-ai", "openai"]).join(" → ")}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Trailing Stop</span>
                <span className="text-sm font-medium">{(config?.trailingStopPercent || 0.05) * 100}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Take Profit</span>
                <span className="text-sm font-medium">{(config?.takeProfitPercent || 0.1) * 100}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Max Drawdown</span>
                <span className="text-sm font-medium text-destructive">{(config?.maxDailyDrawdownPercent || -5)}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd /home/jango/Git/hoox-setup/pages/dashboard && bunx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 3: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/src/app/dashboard/agent/page.tsx
git commit -m "feat(dashboard): add agent overview page"
```
