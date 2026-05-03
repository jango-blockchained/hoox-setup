'use client';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

interface CandlestickChartProps {
  data: CandleData[];
  title?: string;
  description?: string;
  className?: string;
}

const chartConfig = {
  open: { label: "Open", color: "hsl(var(--chart-1))" },
  high: { label: "High", color: "hsl(var(--chart-2))" },
  low: { label: "Low", color: "hsl(var(--chart-3))" },
  close: { label: "Close", color: "hsl(var(--chart-4))" },
} satisfies ChartConfig;

export function CandlestickChart({
  data,
  title = "Price Chart",
  description,
  className,
}: CandlestickChartProps) {
  // Transform data for recharts (using Bar chart to simulate candlestics)
  const chartData = data.map((candle) => ({
    ...candle,
    date: new Date(candle.time).toLocaleDateString(),
    bullish: candle.close >= candle.open,
    body: Math.abs(candle.close - candle.open),
    wickHigh: candle.high - Math.max(candle.open, candle.close),
    wickLow: Math.min(candle.open, candle.close) - candle.low,
  }));

  return (
    <Card className={cn("border-border bg-card backdrop-blur-xl shadow-2xl shadow-primary/5", className)}>
      {title && (
        <CardHeader>
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[350px]">
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          className="text-xs text-muted-foreground"
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          className="text-xs text-muted-foreground"
          domain={['dataMin - 100', 'dataMax + 100']}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(label, payload) => {
                if (payload?.[0]) {
                  const d = payload[0].payload;
                  return (
                    <div className="space-y-1">
                      <p className="font-medium">{label}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <span className="text-muted-foreground">Open:</span>
                        <span className="font-mono">{d.open?.toFixed(2)}</span>
                        <span className="text-muted-foreground">High:</span>
                        <span className="font-mono text-green-500">{d.high?.toFixed(2)}</span>
                        <span className="text-muted-foreground">Low:</span>
                        <span className="font-mono text-red-500">{d.low?.toFixed(2)}</span>
                        <span className="text-muted-foreground">Close:</span>
                        <span className={`font-mono ${d.bullish ? 'text-green-500' : 'text-red-500'}`}>
                          {d.close?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                }
                return label;
              }}
            />
          }
        />
        <Bar
          dataKey="body"
          fill="hsl(var(--chart-1))"
          opacity={0.8}
          radius={1}
        />
        <ReferenceLine y={0} stroke="hsl(var(--border))" />
      </BarChart>
    </ChartContainer>
      </CardContent>
    </Card>
  );
}
