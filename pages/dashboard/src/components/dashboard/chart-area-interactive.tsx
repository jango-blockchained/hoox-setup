"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { useIsMobile } from "@/hooks/use-mobile"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/ui/toggle-group"
import { TrendingUp } from "lucide-react"

export const description = "An interactive area chart for PnL tracking"

// Mock data - replace with real API data
const chartData = [
  { date: "2024-04-01", pnl: 1200, trades: 15 },
  { date: "2024-04-02", pnl: 980, trades: 12 },
  { date: "2024-04-03", pnl: 1450, trades: 18 },
  { date: "2024-04-04", pnl: 2100, trades: 22 },
  { date: "2024-04-05", pnl: 1850, trades: 20 },
  { date: "2024-04-06", pnl: 2400, trades: 25 },
  { date: "2024-04-07", pnl: 1950, trades: 19 },
  { date: "2024-04-08", pnl: 3100, trades: 28 },
  { date: "2024-04-09", pnl: 2750, trades: 24 },
  { date: "2024-04-10", pnl: 3500, trades: 30 },
  { date: "2024-04-11", pnl: 3200, trades: 27 },
  { date: "2024-04-12", pnl: 3800, trades: 32 },
  { date: "2024-04-13", pnl: 4200, trades: 35 },
  { date: "2024-04-14", pnl: 3900, trades: 33 },
  { date: "2024-04-15", pnl: 4500, trades: 38 },
  { date: "2024-04-16", pnl: 4100, trades: 36 },
  { date: "2024-04-17", pnl: 4800, trades: 40 },
  { date: "2024-04-18", pnl: 5200, trades: 42 },
  { date: "2024-04-19", pnl: 4900, trades: 39 },
  { date: "2024-04-20", pnl: 5500, trades: 45 },
  { date: "2024-04-21", pnl: 5800, trades: 48 },
  { date: "2024-04-22", pnl: 6200, trades: 50 },
  { date: "2024-04-23", pnl: 5900, trades: 47 },
  { date: "2024-04-24", pnl: 6500, trades: 52 },
  { date: "2024-04-25", pnl: 7000, trades: 55 },
  { date: "2024-04-26", pnl: 6800, trades: 53 },
  { date: "2024-04-27", pnl: 7200, trades: 58 },
  { date: "2024-04-28", pnl: 7500, trades: 60 },
  { date: "2024-04-29", pnl: 7800, trades: 62 },
  { date: "2024-04-30", pnl: 8200, trades: 65 },
]

const chartConfig = {
  pnl: {
    label: "PnL",
    color: "hsl(var(--chart-1))",
  },
  trades: {
    label: "Trades",
    color: "hsl(var(--chart-2))",
  },
} satisfies ChartConfig

export function ChartAreaInteractive() {
  const isMobile = useIsMobile()
  const [timeRange, setTimeRange] = React.useState("90d")

  React.useEffect(() => {
    if (isMobile) {
      setTimeRange("7d")
    }
  }, [isMobile])

  const filteredData = chartData.filter((item) => {
    const date = new Date(item.date)
    const referenceDate = new Date("2024-04-30")
    let daysToSubtract = 90
    if (timeRange === "30d") {
      daysToSubtract = 30
    } else if (timeRange === "7d") {
      daysToSubtract = 7
    }
    const startDate = new Date(referenceDate)
    startDate.setDate(startDate.getDate() - daysToSubtract)
    return date >= startDate
  })

  const totalPnl = filteredData[filteredData.length - 1]?.pnl || 0
  const isPositive = totalPnl >= 0

  return (
    <Card className="border-border bg-card backdrop-blur-xl shadow-2xl shadow-primary/5 @container/card">
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle className="text-sm font-medium">Performance</CardTitle>
          <span
            className={`flex items-center gap-1 text-xs font-medium ${
              isPositive ? "text-success" : "text-destructive"
            }`}
          >
            <TrendingUp className="h-3 w-3" />
            {isPositive ? "+" : ""}${totalPnl.toLocaleString()}
          </span>
        </div>
        <CardDescription>
          <span className="hidden @[540px]/card:block">
            Total PnL for the last 3 months
          </span>
          <span className="@[540px]/card:hidden">Last 3 months</span>
        </CardDescription>
        <CardAction>
          <ToggleGroup
            type="single"
            value={timeRange}
            onValueChange={setTimeRange}
            variant="outline"
            className="hidden *:data-[slot=toggle-group-item]:px-4! @[767px]/card:flex"
          >
            <ToggleGroupItem value="90d">Last 3 months</ToggleGroupItem>
            <ToggleGroupItem value="30d">Last 30 days</ToggleGroupItem>
            <ToggleGroupItem value="7d">Last 7 days</ToggleGroupItem>
          </ToggleGroup>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger
              className="flex w-40 **:data-[slot=select-value]:block **:data-[slot=select-value]:truncate @[767px]/card:hidden"
              size="sm"
              aria-label="Select a value"
            >
              <SelectValue placeholder="Last 3 months" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="90d" className="rounded-lg">
                Last 3 months
              </SelectItem>
              <SelectItem value="30d" className="rounded-lg">
                Last 30 days
              </SelectItem>
              <SelectItem value="7d" className="rounded-lg">
                Last 7 days
              </SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={filteredData}>
            <defs>
              <linearGradient id="fillPnl" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-pnl)"
                  stopOpacity={0.8}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-pnl)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    return new Date(value).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })
                  }}
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="pnl"
              type="natural"
              fill="url(#fillPnl)"
              stroke="var(--color-pnl)"
              stackId="a"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
