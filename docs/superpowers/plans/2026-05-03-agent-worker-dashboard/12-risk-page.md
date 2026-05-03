### Task 12: Risk Management Page

**Files:**
- Create: `src/app/dashboard/agent/risk/page.tsx`
- Create: `src/components/agent/kill-switch.tsx`
- Create: `src/components/agent/risk-parameters.tsx`
- Create: `src/components/agent/trailing-stops.tsx`

- [ ] **Step 1: Create kill-switch.tsx component**

```tsx
"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Shield, ShieldOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface KillSwitchProps {
  active: boolean;
  onToggle: (action: 'engage_kill_switch' | 'release_kill_switch') => Promise<void>;
}

export function KillSwitch({ active, onToggle }: KillSwitchProps) {
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      await onToggle(active ? 'release_kill_switch' : 'engage_kill_switch');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Alert variant={active ? "destructive" : "default"}>
      {active ? <ShieldOff className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
      <AlertTitle>
        Kill Switch: {active ? "ACTIVE" : "Inactive"}
      </AlertTitle>
      <AlertDescription className="mt-2">
        {active
          ? "Trading is currently blocked due to drawdown limits."
          : "Kill switch is currently disabled. Trading is allowed."}
        <div className="mt-3">
          <Button
            variant={active ? "default" : "destructive"}
            onClick={handleToggle}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Spinner className="h-4 w-4" data-icon="inline-start" />
                Processing...
              </>
            ) : (
              <>
                {active ? (
                  <>
                    <Shield className="h-4 w-4" data-icon="inline-start" />
                    Release Kill Switch
                  </>
                ) : (
                  <>
                    <ShieldOff className="h-4 w-4" data-icon="inline-start" />
                    Engage Kill Switch
                  </>
                )}
              </>
            )}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
```

- [ ] **Step 2: Create risk-parameters.tsx component**

```tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { FieldGroup } from "@/components/ui/field";
import { toast } from "sonner";
import { useState } from "react";

export function RiskParameters() {
  const [drawdown, setDrawdown] = useState(-5);
  const [trailingStop, setTrailingStop] = useState(5);
  const [takeProfit, setTakeProfit] = useState(10);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/agent/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maxDailyDrawdownPercent: drawdown,
          trailingStopPercent: trailingStop / 100,
          takeProfitPercent: takeProfit / 100,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Risk parameters saved");
      } else {
        toast.error(data.error || "Save failed");
      }
    } catch (e) {
      toast.error("Failed to save parameters");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Risk Parameters</CardTitle>
        <CardDescription>Configure risk management settings</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Max Daily Drawdown: {drawdown}%</FieldLabel>
            <Slider
              value={[drawdown]}
              onValueChange={(v) => setDrawdown(v[0])}
              min={-10}
              max={0}
              step={0.5}
              className="w-full"
            />
            <FieldDescription>
              Account will stop trading at this loss percentage
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Trailing Stop: {trailingStop}%</FieldLabel>
            <Slider
              value={[trailingStop]}
              onValueChange={(v) => setTrailingStop(v[0])}
              min={1}
              max={20}
              step={0.5}
              className="w-full"
            />
            <FieldDescription>
              Automatic stop-loss based on highest profit watermark
            </FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Take Profit: {takeProfit}%</FieldLabel>
            <Slider
              value={[takeProfit]}
              onValueChange={(v) => setTakeProfit(v[0])}
              min={1}
              max={50}
              step={1}
              className="w-full"
            />
            <FieldDescription>
              Automatic partial close when position reaches profit target
            </FieldDescription>
          </Field>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Spinner className="h-4 w-4" data-icon="inline-start" />
                Saving...
              </>
            ) : (
              "Save Parameters"
            )}
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create trailing-stops.tsx component**

```tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown } from "lucide-react";

// Mock data - replace with API call
const MOCK_STOPS = [
  { symbol: "BTCUSDT", side: "LONG", entry: 92000, current: 94500, stop: 89500 },
  { symbol: "ETHUSDT", side: "SHORT", entry: 3500, current: 3400, stop: 3700 },
];

export function TrailingStops() {
  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Active Trailing Stops</CardTitle>
        <CardDescription>Currently monitored positions</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Symbol</TableHead>
              <TableHead>Side</TableHead>
              <TableHead>Entry</TableHead>
              <TableHead>Current</TableHead>
              <TableHead>Stop</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_STOPS.map((stop) => (
              <TableRow key={stop.symbol}>
                <TableCell className="font-medium">{stop.symbol}</TableCell>
                <TableCell>
                  <Badge variant={stop.side === "LONG" ? "default" : "destructive"}>
                    {stop.side === "LONG" ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {stop.side}
                  </Badge>
                </TableCell>
                <TableCell>${stop.entry.toLocaleString()}</TableCell>
                <TableCell className="text-emerald-500">
                  ${stop.current.toLocaleString()}
                </TableCell>
                <TableCell className="text-destructive">
                  ${stop.stop.toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create risk/page.tsx**

```tsx
"use client";

import { KillSwitch } from "@/components/agent/kill-switch";
import { RiskParameters } from "@/components/agent/risk-parameters";
import { TrailingStops } from "@/components/agent/trailing-stops";
import { Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function RiskPage() {
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/agent/status");
      const data = await res.json();
      if (data.success) {
        setKillSwitchActive(data.status?.killSwitch || false);
      }
    } catch (e) {
      toast.error("Failed to fetch status");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleToggleKillSwitch = async (action: 'engage_kill_switch' | 'release_kill_switch') => {
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
      toast.error("Failed to toggle kill switch");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <Shield className="h-8 w-8 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Risk Management</h1>
          <p className="text-sm text-muted-foreground">
            Parameters & overrides
          </p>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="h-32 bg-secondary/30 rounded-lg animate-pulse" />
          <div className="h-64 bg-secondary/30 rounded-lg animate-pulse" />
          <div className="h-48 bg-secondary/30 rounded-lg animate-pulse" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <KillSwitch
              active={killSwitchActive}
              onToggle={handleToggleKillSwitch}
            />
            <RiskParameters />
          </div>
          <TrailingStops />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run typecheck**

Run: `cd /home/jango/Git/hoox-setup/pages/dashboard && bunx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/src/app/dashboard/agent/risk/page.tsx
git add pages/dashboard/src/components/agent/kill-switch.tsx
git add pages/dashboard/src/components/agent/risk-parameters.tsx
git add pages/dashboard/src/components/agent/trailing-stops.tsx
git commit -m "feat(dashboard): add agent risk management page"
```
