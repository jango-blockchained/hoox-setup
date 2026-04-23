import { SignalFlowVisualization } from "@/components/dashboard/signal-flow-visualization"

export const dynamic = "force-dynamic"
export const runtime = "edge"

export default function SignalFlowPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Signal Flow Pipeline</h1>
        <p className="text-sm text-muted-foreground">
          Real-time visualization of signal processing through workers
        </p>
      </div>

      <SignalFlowVisualization />
    </div>
  )
}