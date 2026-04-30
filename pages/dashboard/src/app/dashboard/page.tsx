"use client";

import { MetricsCards } from "@/components/dashboard/metrics-cards"
import { PnlChart } from "@/components/dashboard/pnl-chart"
import { AiHealthCard } from "@/components/dashboard/ai-health-card"
import { WorkersOverview } from "@/components/dashboard/workers-overview"
import { DistributionChart } from "@/components/dashboard/distribution-chart"
import { Activity } from "lucide-react"
import { motion } from "framer-motion"

// Mock data for distribution charts
const exchangeDistribution = [
  { name: "Binance", value: 45, fill: "hsl(var(--chart-1))" },
  { name: "Bybit", value: 30, fill: "hsl(var(--chart-2))" },
  { name: "MEXC", value: 25, fill: "hsl(var(--chart-3))" },
]

const sideDistribution = [
  { name: "Long", value: 60, fill: "hsl(var(--chart-4))" },
  { name: "Short", value: 40, fill: "hsl(var(--chart-5))" },
]

export default function DashboardPage() {
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
          <Activity className="h-8 w-8 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Command Center</h1>
          <p className="text-sm text-muted-foreground">
            Monitor your trading system in real-time
          </p>
        </div>
      </motion.div>

      <MetricsCards />
      
      <div className="grid gap-6 md:grid-cols-2">
        <PnlChart />
        <div className="space-y-6">
          <DistributionChart
            data={exchangeDistribution}
            title="Exchange Distribution"
            description="Positions by exchange"
            type="donut"
          />
          <DistributionChart
            data={sideDistribution}
            title="Position Sides"
            description="Long vs Short distribution"
            type="pie"
          />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <AiHealthCard />
        <WorkersOverview />
      </div>
    </div>
  )
}
