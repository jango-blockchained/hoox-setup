"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Search, RefreshCw, Download, Filter } from "lucide-react"

type LogLevel = "info" | "warn" | "error" | "debug"

interface LogEntry {
  id: string
  timestamp: number
  level: LogLevel
  worker: string
  message: string
  details?: string
}

const logs: LogEntry[] = [
  {
    id: "log-001",
    timestamp: Date.now() - 1000 * 10,
    level: "info",
    worker: "trade-worker",
    message: "Order executed successfully",
    details: "BTC/USDT LONG 0.125 @ $67,250.00",
  },
  {
    id: "log-002",
    timestamp: Date.now() - 1000 * 25,
    level: "info",
    worker: "hoox",
    message: "Webhook received from TradingView",
    details: "Signal: BTCUSDT.P, Action: LONG",
  },
  {
    id: "log-003",
    timestamp: Date.now() - 1000 * 45,
    level: "debug",
    worker: "agent-worker",
    message: "Risk check passed",
    details: "Position size within limits, leverage acceptable",
  },
  {
    id: "log-004",
    timestamp: Date.now() - 1000 * 60,
    level: "info",
    worker: "d1-worker",
    message: "Trade logged to database",
    details: "ID: 8f7e6d5c, Status: filled",
  },
  {
    id: "log-005",
    timestamp: Date.now() - 1000 * 120,
    level: "warn",
    worker: "telegram-worker",
    message: "Rate limit approaching",
    details: "28/30 messages sent in the last minute",
  },
  {
    id: "log-006",
    timestamp: Date.now() - 1000 * 180,
    level: "info",
    worker: "agent-worker",
    message: "Trailing stop updated",
    details: "ETH/USDT stop moved to $3,450.00",
  },
  {
    id: "log-007",
    timestamp: Date.now() - 1000 * 240,
    level: "error",
    worker: "trade-worker",
    message: "Order rejected by exchange",
    details: "Insufficient balance for margin requirement",
  },
  {
    id: "log-008",
    timestamp: Date.now() - 1000 * 300,
    level: "info",
    worker: "hoox",
    message: "IP validation successful",
    details: "Request from 52.89.214.238 (TradingView)",
  },
  {
    id: "log-009",
    timestamp: Date.now() - 1000 * 360,
    level: "debug",
    worker: "d1-worker",
    message: "Query executed",
    details: "SELECT * FROM positions WHERE status = 'open'",
  },
  {
    id: "log-010",
    timestamp: Date.now() - 1000 * 420,
    level: "info",
    worker: "telegram-worker",
    message: "Notification sent",
    details: "Trade alert delivered to chat ID: -1001234567890",
  },
]

const levelColors: Record<LogLevel, string> = {
  info: "bg-primary/20 text-primary",
  warn: "bg-warning/20 text-warning",
  error: "bg-destructive/20 text-destructive",
  debug: "bg-muted text-muted-foreground",
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

export function LogsViewer() {
  const [filter, setFilter] = useState<string>("all")
  const [workerFilter, setWorkerFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState<string>("")

  const filteredLogs = logs.filter((log) => {
    const matchesLevel = filter === "all" || log.level === filter
    const matchesWorker = workerFilter === "all" || log.worker === workerFilter
    const matchesSearch =
      searchQuery === "" ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.details?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesLevel && matchesWorker && matchesSearch
  })

  const workers = [...new Set(logs.map((log) => log.worker))]

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-medium">System Logs</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8">
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="h-8">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 bg-secondary/50 pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="h-9 w-[100px] bg-secondary/50">
                <SelectValue placeholder="Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warning</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
              </SelectContent>
            </Select>
            <Select value={workerFilter} onValueChange={setWorkerFilter}>
              <SelectTrigger className="h-9 w-[140px] bg-secondary/50">
                <SelectValue placeholder="Worker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Workers</SelectItem>
                {workers.map((worker) => (
                  <SelectItem key={worker} value={worker}>
                    {worker}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="h-[500px] rounded-md border border-border bg-sidebar p-1">
          <div className="flex flex-col font-mono text-sm">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 border-b border-border/50 px-3 py-2 last:border-0 hover:bg-secondary/30"
              >
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatTimestamp(log.timestamp)}
                </span>
                <Badge
                  variant="secondary"
                  className={`shrink-0 text-[10px] uppercase ${levelColors[log.level]}`}
                >
                  {log.level}
                </Badge>
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  {log.worker}
                </Badge>
                <div className="flex flex-col gap-0.5">
                  <span className="text-foreground">{log.message}</span>
                  {log.details && (
                    <span className="text-xs text-muted-foreground">
                      {log.details}
                    </span>
                  )}
                </div>
              </div>
            ))}
            {filteredLogs.length === 0 && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                No logs found matching your filters.
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span>Showing {filteredLogs.length} of {logs.length} logs</span>
          <span>Auto-refresh: 5s</span>
        </div>
      </CardContent>
    </Card>
  )
}
