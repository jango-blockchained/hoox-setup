### Task 13: Usage Statistics Page

**Files:**
- Create: `src/app/dashboard/agent/usage/page.tsx`
- Create: `src/components/agent/usage-chart.tsx`
- Create: `src/components/agent/usage-table.tsx`

- [ ] **Step 1: Create usage-chart.tsx component**

```tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartConfig, ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

// Mock data - replace with API
const DAILY_DATA = [
  { date: "2026-04-28", "workers-ai": 120, openai: 45, anthropic: 12 },
  { date: "2026-04-29", "workers-ai": 150, openai: 52, anthropic: 15 },
  { date: "2026-04-30", "workers-ai": 180, openai: 60, anthropic: 18 },
  { date: "2026-05-01", "workers-ai": 200, openai: 70, anthropic: 20 },
  { date: "2026-05-02", "workers-ai": 170, openai: 65, anthropic: 16 },
  { date: "2026-05-03", "workers-ai": 190, openai: 68, anthropic: 19 },
];

const chartConfig = {
  "workers-ai": { label: "Workers AI", color: "hsl(var(--chart-1))" },
  openai: { label: "OpenAI", color: "hsl(var(--chart-2))" },
  anthropic: { label: "Anthropic", color: "hsl(var(--chart-3))" },
} satisfies ChartConfig;

export function UsageChart() {
  const [timeRange, setTimeRange] = useState("7d");

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Usage Over Time</CardTitle>
            <CardDescription>Tokens consumed per day</CardDescription>
          </div>
          <Tabs value={timeRange} onValueChange={setTimeRange}>
            <TabsList>
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
          <AreaChart data={DAILY_DATA}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => value.slice(5)}
            />
            <YAxis tickLine={false} axisLine={false} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              type="monotone"
              dataKey="workers-ai"
              stroke="var(--color-workers-ai)"
              fill="var(--color-workers-ai)"
              fillOpacity={0.2}
            />
            <Area
              type="monotone"
              dataKey="openai"
              stroke="var(--color-openai)"
              fill="var(--color-openai)"
              fillOpacity={0.2}
            />
            <Area
              type="monotone"
              dataKey="anthropic"
              stroke="var(--color-anthropic)"
              fill="var(--color-anthropic)"
              fillOpacity={0.2}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create usage-table.tsx component**

```tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

// Mock data - replace with API
const PROVIDER_DATA = [
  { name: "workers-ai", requests: 850, tokens: 300000, avgLatency: 150, cost: "$0.00" },
  { name: "openai", requests: 320, tokens: 120000, avgLatency: 200, cost: "$9.60" },
  { name: "anthropic", requests: 77, tokens: 30000, avgLatency: 350, cost: "$2.75" },
];

export function UsageTable() {
  const totalRequests = PROVIDER_DATA.reduce((sum, p) => sum + p.requests, 0);
  const totalTokens = PROVIDER_DATA.reduce((sum, p) => sum + p.tokens, 0);
  const totalCost = PROVIDER_DATA.reduce((sum, p) => sum + parseFloat(p.cost.replace("$", "")), 0);

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Provider Breakdown</CardTitle>
        <CardDescription>Usage statistics by provider</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-2xl font-bold">{totalRequests.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Requests</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-2xl font-bold">{totalTokens.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Tokens</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">Est. Cost</p>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>Avg Latency</TableHead>
              <TableHead>Cost</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PROVIDER_DATA.map((provider) => (
              <TableRow key={provider.name}>
                <TableCell className="font-medium">
                  <Badge variant="outline">{provider.name}</Badge>
                </TableCell>
                <TableCell>{provider.requests.toLocaleString()}</TableCell>
                <TableCell>{provider.tokens.toLocaleString()}</TableCell>
                <TableCell>{provider.avgLatency}ms</TableCell>
                <TableCell>{provider.cost}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create usage/page.tsx**

```tsx
"use client";

import { UsageChart } from "@/components/agent/usage-chart";
import { UsageTable } from "@/components/agent/usage-table";
import { BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function UsagePage() {
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
          <BarChart3 className="h-8 w-8 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usage Statistics</h1>
          <p className="text-sm text-muted-foreground">
            AI API consumption
          </p>
        </div>
      </motion.div>

      <UsageChart />
      <UsageTable />
    </div>
  );
}
```

- [ ] **Step 4: Run typecheck**

Run: `cd /home/jango/Git/hoox-setup/pages/dashboard && bunx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 5: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/src/app/dashboard/agent/usage/page.tsx
git add pages/dashboard/src/components/agent/usage-chart.tsx
git add pages/dashboard/src/components/agent/usage-table.tsx
git commit -m "feat(dashboard): add agent usage statistics page"
```
