'use client';

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { Pie, PieChart, Sector } from "recharts";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DistributionData {
  name: string;
  value: number;
  fill?: string;
}

interface DistributionChartProps {
  data: DistributionData[];
  title?: string;
  description?: string;
  type?: 'pie' | 'donut';
  className?: string;
}

export function DistributionChart({
  data,
  title = "Distribution",
  description,
  type = 'donut',
  className,
}: DistributionChartProps) {
  const [activeIndex, setActiveIndex] = useState<number>(-1);

  const chartConfig = data.reduce((acc, item, index) => {
    acc[item.name.toLowerCase().replace(/\s+/g, '-')] = {
      label: item.name,
      color: item.fill || `hsl(var(--chart-${index + 1}))`,
    };
    return acc;
  }, {} as ChartConfig);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className={cn("flex flex-col", className)}>
      <CardHeader className="items-center pb-0">
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[250px]"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel />}
            />
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={type === 'donut' ? 60 : 0}
              strokeWidth={5}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(-1)}
            />
          </PieChart>
        </ChartContainer>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          {data.map((item, index) => (
            <div
              key={item.name}
              className="flex items-center gap-2 text-sm"
              onMouseEnter={() => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(-1)}
            >
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: item.fill || `hsl(var(--chart-${index + 1}))` }}
              />
              <span className="text-muted-foreground">{item.name}</span>
              <span className="font-medium">
                {((item.value / total) * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
