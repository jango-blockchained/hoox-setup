import { MetricsCards } from "@/components/dashboard/metrics-cards"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { AiHealthCard } from "@/components/dashboard/ai-health-card"
import { PnlChart } from "@/components/dashboard/pnl-chart"
import { WorkersOverview } from "@/components/dashboard/workers-overview"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { SignalFlowVisualization } from "@/components/dashboard/signal-flow-visualization"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Overview</h1>
          <p className="text-sm text-muted-foreground">
            Monitor your trading system in real-time
          </p>
        </div>
        <QuickActions />
      </div>

      <MetricsCards />

      <SignalFlowVisualization />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <AiHealthCard />
          <PnlChart />
          <RecentActivity />
        </div>
        <div className="flex flex-col gap-6">
          <WorkersOverview />
        </div>
      </div>
    </div>
  )
}
