"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from "recharts"
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { TrendingUp, TrendingDown } from "lucide-react"

const generateData = (period: string) => {
  const now = new Date()
  const data = []
  const periods = period === "1D" ? 24 : period === "1W" ? 7 : period === "1M" ? 30 : 12
  
  let cumulative = 0
  for (let i = 0; i < periods; i++) {
    const change = (Math.random() - 0.4) * 500
    cumulative += change
    
    let label = ""
    if (period === "1D") {
      label = `${(i).toString().padStart(2, "0")}:00`
    } else if (period === "1W") {
      const d = new Date(now)
      d.setDate(d.getDate() - (periods - 1 - i))
      label = d.toLocaleDateString("en-US", { weekday: "short" })
    } else if (period === "1M") {
      label = `Day ${i + 1}`
    } else {
      label = new Date(now.getFullYear(), i, 1).toLocaleDateString("en-US", { month: "short" })
    }
    
    data.push({
      date: label,
      pnl: Math.round(cumulative * 100) / 100,
      trades: Math.floor(Math.random() * 20) + 5,
    })
  }
  return data
}

const chartConfig = {
  pnl: {
    label: "PnL",
    color: "var(--color-chart-1)",
  },
}

export function PnlChart() {
  const [period, setPeriod] = useState("1M")
  const [data, setData] = useState(() => generateData("1M"))

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    setData(generateData(newPeriod))
  }

  const totalPnl = data[data.length - 1]?.pnl || 0
  const isPositive = totalPnl >= 0
  const maxPnl = Math.max(...data.map((d) => d.pnl))
  const minPnl = Math.min(...data.map((d) => d.pnl))

  return (
    <Card className="bg-card border-border transition-all duration-300 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.01]">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-medium">Performance</CardTitle>
          <Badge 
            variant="secondary" 
            className={`gap-1 ${isPositive ? "text-success" : "text-destructive"}`}
          >
            {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {isPositive ? "+" : ""}${totalPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Badge>
        </div>
        <div className="flex gap-1">
          {["1D", "1W", "1M", "1Y"].map((p) => (
            <Button
              key={p}
              variant={period === p ? "secondary" : "ghost"}
              size="sm"
              className="h-7 px-2.5 text-xs"
              onClick={() => handlePeriodChange(p)}
            >
              {p}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGradientPositive" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-success)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-success)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="pnlGradientNegative" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-destructive)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-destructive)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="var(--color-border)" 
                vertical={false}
              />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
                interval="preserveStartEnd"
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
                tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}`}
                width={50}
              />
              <ReferenceLine y={0} stroke="var(--color-muted-foreground)" strokeDasharray="3 3" />
              <Tooltip 
                content={<ChartTooltipContent />}
                cursor={{ stroke: 'var(--color-primary)', strokeWidth: 1, strokeDasharray: '5 5' }}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke={isPositive ? "var(--color-success)" : "var(--color-destructive)"}
                strokeWidth={2}
                fill={isPositive ? "url(#pnlGradientPositive)" : "url(#pnlGradientNegative)"}
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartContainer>
        
        {/* Stats Row */}
        <div className="mt-4 grid grid-cols-4 gap-4 border-t border-border pt-4">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">High</p>
            <p className="text-sm font-medium text-success">+${maxPnl.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Low</p>
            <p className="text-sm font-medium text-destructive">${minPnl.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Trades</p>
            <p className="text-sm font-medium text-foreground">{data.reduce((acc, d) => acc + d.trades, 0)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg/Trade</p>
            <p className={`text-sm font-medium ${isPositive ? "text-success" : "text-destructive"}`}>
              ${(totalPnl / data.reduce((acc, d) => acc + d.trades, 0)).toFixed(2)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
