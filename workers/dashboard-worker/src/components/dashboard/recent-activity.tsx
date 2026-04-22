"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ArrowUpRight, ArrowDownRight, Clock, Zap } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface Activity {
  id: string
  symbol: string
  side: "LONG" | "SHORT"
  exchange: string
  timestamp: number
  status: "filled" | "closed" | "pending"
  price: number
  size: number
  pnl?: number
}

const initialActivity: Activity[] = [
  {
    id: "8f7e6d5c",
    symbol: "BTC/USDT",
    side: "LONG",
    exchange: "binance",
    timestamp: Date.now() - 1000 * 60 * 5,
    status: "filled",
    price: 68420.50,
    size: 0.125,
  },
  {
    id: "4a3b2c1d",
    symbol: "ETH/USDT",
    side: "SHORT",
    exchange: "mexc",
    timestamp: Date.now() - 1000 * 60 * 23,
    status: "filled",
    price: 3485.20,
    size: 2.5,
  },
  {
    id: "9e8f7a6b",
    symbol: "SOL/USDT",
    side: "LONG",
    exchange: "bybit",
    timestamp: Date.now() - 1000 * 60 * 45,
    status: "filled",
    price: 145.80,
    size: 50,
  },
  {
    id: "2c3d4e5f",
    symbol: "DOGE/USDT",
    side: "LONG",
    exchange: "binance",
    timestamp: Date.now() - 1000 * 60 * 120,
    status: "closed",
    price: 0.1198,
    size: 10000,
    pnl: 47.50,
  },
  {
    id: "1a2b3c4d",
    symbol: "XRP/USDT",
    side: "SHORT",
    exchange: "mexc",
    timestamp: Date.now() - 1000 * 60 * 180,
    status: "closed",
    price: 0.5234,
    size: 5000,
    pnl: -23.80,
  },
]

const symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "DOGE/USDT", "XRP/USDT", "AVAX/USDT", "LINK/USDT"]
const exchanges = ["binance", "mexc", "bybit"]

function formatTimeAgo(timestamp: number) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

function generateId() {
  return Math.random().toString(16).slice(2, 10)
}

export function RecentActivity() {
  const [activities, setActivities] = useState(initialActivity)
  const [isLive, setIsLive] = useState(true)

  useEffect(() => {
    if (!isLive) return

    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const newActivity: Activity = {
          id: generateId(),
          symbol: symbols[Math.floor(Math.random() * symbols.length)],
          side: Math.random() > 0.5 ? "LONG" : "SHORT",
          exchange: exchanges[Math.floor(Math.random() * exchanges.length)],
          timestamp: Date.now(),
          status: "filled",
          price: Math.random() * 70000,
          size: Math.random() * 100,
        }
        setActivities((prev) => [newActivity, ...prev.slice(0, 9)])
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [isLive])

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
        <button
          onClick={() => setIsLive(!isLive)}
          className="flex items-center gap-1.5"
        >
          <Badge 
            variant={isLive ? "default" : "secondary"} 
            className={`gap-1 text-xs cursor-pointer transition-colors ${isLive ? "bg-success/20 text-success hover:bg-success/30" : ""}`}
          >
            <Zap className={`h-3 w-3 ${isLive ? "animate-pulse" : ""}`} />
            {isLive ? "Live" : "Paused"}
          </Badge>
        </button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[320px] pr-4">
          <AnimatePresence mode="popLayout">
            <div className="flex flex-col gap-2">
              {activities.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  layout
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  className="group relative overflow-hidden rounded-lg bg-secondary/30 p-3 transition-colors hover:bg-secondary/50"
                >
                  {/* New indicator */}
                  {Date.now() - activity.timestamp < 10000 && (
                    <motion.div
                      initial={{ opacity: 1 }}
                      animate={{ opacity: 0 }}
                      transition={{ duration: 10 }}
                      className="absolute left-0 top-0 h-full w-1 bg-primary"
                    />
                  )}
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-transform group-hover:scale-105 ${
                          activity.side === "LONG" ? "bg-success/20" : "bg-destructive/20"
                        }`}
                      >
                        {activity.side === "LONG" ? (
                          <ArrowUpRight className="h-4 w-4 text-success" />
                        ) : (
                          <ArrowDownRight className="h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {activity.symbol}
                          </p>
                          <span
                            className={`text-xs font-medium ${
                              activity.side === "LONG" ? "text-success" : "text-destructive"
                            }`}
                          >
                            {activity.side}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {activity.id}
                          </span>
                          <Badge
                            variant={activity.status === "filled" ? "default" : activity.status === "closed" ? "secondary" : "outline"}
                            className="h-4 px-1 text-[10px]"
                          >
                            {activity.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-medium text-foreground capitalize">{activity.exchange}</p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground mt-0.5">
                        <Clock className="h-3 w-3" />
                        {formatTimeAgo(activity.timestamp)}
                      </div>
                      {activity.pnl !== undefined && (
                        <p className={`text-xs font-medium mt-0.5 ${activity.pnl >= 0 ? "text-success" : "text-destructive"}`}>
                          {activity.pnl >= 0 ? "+" : ""}${activity.pnl.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </AnimatePresence>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
