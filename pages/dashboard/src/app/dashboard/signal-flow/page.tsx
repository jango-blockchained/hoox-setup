'use client';

import { SignalFlowVisualization } from "@/components/dashboard/signal-flow-visualization"
import { GitBranch } from "lucide-react"
import { motion } from "framer-motion"

export const dynamic = "force-dynamic"
export const runtime = "edge"

export default function SignalFlowPage() {
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
          <GitBranch className="h-8 w-8 text-primary" />
        </motion.div>
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Signal Flow Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Real-time visualization of signal processing through workers
          </p>
        </div>
      </motion.div>

      <SignalFlowVisualization />
    </div>
  )
}