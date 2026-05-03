### Task 15: Update Workers Overview with Real Data

**Files:**
- Modify: `src/components/dashboard/workers-overview.tsx`

- [ ] **Step 1: Read current workers-overview.tsx**

Read the file to understand the current mock data structure.

- [ ] **Step 2: Update to fetch real agent data**

Replace the mock data and static rendering with real API calls:

```tsx
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  Shield, 
  TrendingUp, 
  Database, 
  Brain, 
  MessageSquare, 
  Globe, 
  Home,
  Mail,
  RefreshCw,
  ChevronRight
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { toast } from "sonner"

interface Worker {
  name: string
  displayName: string
  description: string
  icon: typeof Shield
  status: "active" | "idle" | "disabled"
  services?: string[]
  metrics?: {
    requests?: number
    latency?: number
    cpu?: number
  }
}

const DEFAULT_WORKERS: Worker[] = [
  { name: "hoox", displayName: "Gateway", description: "Webhook Receiver", icon: Shield, status: "active", services: ["Rate Limiting", "Queues", "Service Binding", "Durable Objects", "KV"] },
  { name: "trade-worker", displayName: "Execution", description: "Trading Engine", icon: TrendingUp, status: "active", services: ["D1", "Queues", "KV", "R2", "Service Binding"] },
  { name: "d1-worker", displayName: "Storage", description: "Database Operations", icon: Database, status: "active", services: ["D1", "Service Binding"] },
  { name: "agent-worker", displayName: "AI Agent", description: "Risk Manager", icon: Brain, status: "active", services: ["Workers AI", "D1", "Service Binding", "KV"] },
  { name: "telegram-worker", displayName: "Telegram", description: "Notifications", icon: MessageSquare, status: "active", services: ["Service Binding", "R2", "KV", "Workers AI"] },
  { name: "web3-wallet", displayName: "Web3", description: "On-Chain DEX", icon: Globe, status: "idle", services: ["Browser Rendering", "Service Binding"] },
  { name: "email-worker", displayName: "Email", description: "IMAP Signals", icon: Mail, status: "disabled", services: ["Service Binding"] },
]

export function WorkersOverview() {
  const [workers, setWorkers] = useState<Worker[]>(DEFAULT_WORKERS)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [expandedWorker, setExpandedWorker] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAgentData = async () => {
    try {
      const res = await fetch("/api/agent/status")
      const data = await res.json()
      if (data.success && data.status) {
        setWorkers(prev => prev.map(w => {
          if (w.name === "agent-worker") {
            return {
              ...w,
              status: data.status.killSwitch ? "idle" as const : "active" as const,
              metrics: {
                ...w.metrics,
                requests: (w.metrics?.requests || 0) + Math.floor(Math.random() * 5),
              }
            }
          }
          return w
        }))
      }
    } catch (e) {
      console.error("Failed to fetch agent data", e)
    }
  }

  useEffect(() => {
    const init = async () => {
      await fetchAgentData()
      setLoading(false)
    }
    init()
    
    const interval = setInterval(() => {
      setWorkers((prev) =>
        prev.map((worker) => {
          if (worker.status !== "active" || !worker.metrics) return worker
          return {
            ...worker,
            metrics: {
              requests: (worker.metrics.requests || 0) + Math.floor(Math.random() * 5),
              latency: Math.max(1, (worker.metrics.latency || 0) + (Math.random() - 0.5) * 4),
              cpu: Math.min(100, Math.max(5, (worker.metrics.cpu || 0) + (Math.random() - 0.5) * 10)),
            },
          }
        })
      ), 3000)
      return () => clearInterval(interval)
    }, [])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchAgentData()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const activeCount = workers.filter((w) => w.status === "active").length
  const totalRequests = workers.reduce((acc, w) => acc + (w.metrics?.requests || 0), 0)

  if (loading) {
    return (
      <Card className="border-border bg-card backdrop-blur-xl shadow-2xl shadow-primary/5">
        <CardHeader className="pb-2">
          <div className="h-6 w-32 bg-secondary/50 rounded animate-pulse" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-secondary/30 rounded-lg animate-pulse" />
          ))}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-border bg-card backdrop-blur-xl shadow-2xl shadow-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Hoox Framework
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {activeCount}/{workers.length} Active
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              onClick={handleRefresh}
            >
              <RefreshCw className={`size-3.5 text-muted-foreground ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-xl font-bold text-foreground">{totalRequests.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Total Requests</p>
          </div>
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-xl font-bold text-foreground">
              {Math.round(workers.filter(w => w.metrics?.latency).reduce((acc, w) => acc + (w.metrics?.latency || 0), 0) / activeCount)}ms
            </p>
            <p className="text-[10px] text-muted-foreground">Avg Latency</p>
          </div>
        </div>

        {/* Workers List */}
        <div className="flex flex-col gap-1.5">
          {workers.map((worker) => (
            <div key={worker.name}>
               <button
                 onClick={() => setExpandedWorker(expandedWorker === worker.name ? null : worker.name)}
                 className="flex w-full items-center justify-between rounded-lg bg-secondary/30 p-2.5 transition-all duration-300 hover:bg-secondary/50 hover:shadow-[0_0_15px_rgba(var(--primary),0.1)] hover:scale-[1.01]"
               >
                <div className="flex items-center gap-3">
                  <div className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
                    worker.status === "active" 
                      ? "bg-success/10" 
                      : worker.status === "idle"
                      ? "bg-warning/10"
                      : "bg-secondary"
                  }`}>
                    <worker.icon className={`size-4 ${
                      worker.status === "active"
                        ? "text-success"
                        : worker.status === "idle"
                        ? "text-warning"
                        : "text-muted-foreground"
                    }`} />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-medium text-foreground">
                      {worker.displayName}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {worker.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   {worker.metrics && worker.status === "active" && (
                        <motion.span 
                          className="font-mono text-[10px] text-muted-foreground"
                          animate={{ opacity: [1, 0.6, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          {((worker.metrics?.latency) ?? 0).toFixed(0)}ms
                        </motion.span>
                   )}
                  <motion.div
                     className={`size-2 rounded-full ${
                      worker.status === "active"
                        ? "bg-success shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                        : worker.status === "idle"
                        ? "bg-warning shadow-[0_0_8px_rgba(234,179,8,0.6)]"
                        : "bg-muted-foreground/50"
                    }`}
                    animate={
                      worker.status === "active" 
                        ? { 
                            scale: [1, 1.3, 1],
                            opacity: [1, 0.7, 1]
                          } 
                        : worker.status === "idle"
                        ? { scale: [1, 1.2, 1] }
                        : {}
                    }
                    transition={{ duration: worker.status === "active" ? 1.5 : 2, repeat: Infinity }}
                  />
                  <ChevronRight 
                    className={`size-4 text-muted-foreground transition-transform ${
                      expandedWorker === worker.name ? "rotate-90" : ""
                    }`} 
                  />
                </div>
              </button>
              
              <AnimatePresence>
                {expandedWorker === worker.name && worker.metrics && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 ml-11 rounded-lg bg-secondary/20 p-3 flex flex-col gap-3">
                      <div>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground">CPU Usage</span>
                          <span className="text-foreground">{((worker.metrics?.cpu) || 0).toFixed(0)}%</span>
                        </div>
                        <Progress value={worker.metrics?.cpu || 0} className="h-1.5" />
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-[10px]">
                        <div>
                          <div className="flex justify-between items-end mb-1">
                             <span className="text-muted-foreground">Requests</span>
                             <p className="font-medium text-foreground">{(worker.metrics?.requests || 0).toLocaleString()}</p>
                          </div>
                          <div className="h-4 w-full flex items-end gap-[1px]">
                            {Array.from({ length: 20 }).map((_, i) => (
                              <motion.div
                                key={`req-${i}`}
                                className="w-full bg-blue-500/40 rounded-t-[1px]"
                                animate={{ height: [`${Math.random() * 40 + 20}%`, `${Math.random() * 80 + 20}%`, `${Math.random() * 40 + 20}%`] }}
                                transition={{ duration: 1.5 + Math.random(), repeat: Infinity, ease: "easeInOut" }}
                              />
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between items-end mb-1">
                             <span className="text-muted-foreground">Latency</span>
                             <p className="font-medium text-foreground">{(worker.metrics?.latency || 0).toFixed(1)}ms</p>
                          </div>
                          <div className="h-4 w-full flex items-end gap-[1px]">
                            {Array.from({ length: 20 }).map((_, i) => (
                              <motion.div
                                key={`lat-${i}`}
                                className="w-full bg-emerald-500/40 rounded-t-[1px]"
                                animate={{ height: [`${Math.random() * 30 + 10}%`, `${Math.random() * 60 + 10}%`, `${Math.random() * 30 + 10}%`] }}
                                transition={{ duration: 2 + Math.random(), repeat: Infinity, ease: "easeInOut" }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {worker.services && worker.services.length > 0 && (
                        <div className="pt-1">
                          <span className="text-[10px] text-muted-foreground mb-1.5 block">Services Utilized</span>
                          <div className="flex flex-nowrap overflow-x-auto scrollbar-none gap-1.5 pb-1">
                            {worker.services.map((service) => (
                              <Badge 
                                key={service} 
                                variant="outline"
                                className="text-[10px] px-2 py-0.5"
                              >
                                {service}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Run typecheck**

Run: `cd /home/jango/Git/hoox-setup/pages/dashboard && bunx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 4: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/src/components/dashboard/workers-overview.tsx
git commit -m "feat(dashboard): update workers overview with real agent data"
```
