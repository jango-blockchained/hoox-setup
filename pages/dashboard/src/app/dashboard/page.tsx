"use client"

import { MetricsCards } from "@/components/dashboard/metrics-cards"
import { RecentActivity } from "@/components/dashboard/recent-activity"
import { AiHealthCard } from "@/components/dashboard/ai-health-card"
import { PnlChart } from "@/components/dashboard/pnl-chart"
import { WorkersOverview } from "@/components/dashboard/workers-overview"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { Activity, Globe, Zap, Server, ShieldCheck } from "lucide-react"
import { motion } from "framer-motion"

function SystemResources() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="grid grid-cols-2 md:grid-cols-4 gap-4"
    >
      <div className="flex items-center gap-3 p-3 rounded-xl border border-neutral-800 bg-neutral-950/80 backdrop-blur shadow-lg hover:bg-neutral-900/50 transition-colors">
        <div className="p-2 bg-neutral-900 text-blue-500 rounded-lg border border-neutral-800 shadow-inner">
          <Globe className="size-4" />
        </div>
        <div>
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Edge Locations</p>
          <p className="font-bold text-sm text-neutral-200">310+ Global</p>
        </div>
      </div>
      <div className="flex items-center gap-3 p-3 rounded-xl border border-neutral-800 bg-neutral-950/80 backdrop-blur shadow-lg hover:bg-neutral-900/50 transition-colors">
        <div className="p-2 bg-neutral-900 text-emerald-500 rounded-lg border border-neutral-800 shadow-inner">
          <Zap className="size-4" />
        </div>
        <div>
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Avg Latency</p>
          <p className="font-bold text-sm text-neutral-200">~12ms</p>
        </div>
      </div>
      <div className="flex items-center gap-3 p-3 rounded-xl border border-neutral-800 bg-neutral-950/80 backdrop-blur shadow-lg hover:bg-neutral-900/50 transition-colors">
        <div className="p-2 bg-neutral-900 text-purple-500 rounded-lg border border-neutral-800 shadow-inner">
          <Activity className="size-4" />
        </div>
        <div>
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">24h Requests</p>
          <p className="font-bold text-sm text-neutral-200">1.2M+</p>
        </div>
      </div>
      <div className="flex items-center gap-3 p-3 rounded-xl border border-neutral-800 bg-neutral-950/80 backdrop-blur shadow-lg hover:bg-neutral-900/50 transition-colors">
        <div className="p-2 bg-neutral-900 text-primary rounded-lg border border-neutral-800 shadow-inner">
          <ShieldCheck className="size-4" />
        </div>
        <div>
          <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-semibold">Security</p>
          <p className="font-bold text-sm text-neutral-200">Zero Trust</p>
        </div>
      </div>
    </motion.div>
  )
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6 pb-8 relative min-h-screen bg-black">
      {/* Ambient background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] brightness-100 contrast-150 pointer-events-none mix-blend-overlay"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between relative z-10"
      >
        <div>
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-br from-white to-neutral-400 bg-clip-text text-transparent">Command Center</h1>
          <p className="text-sm text-neutral-500 font-medium">
            Monitor your trading system in real-time across the edge
          </p>
        </div>
        <QuickActions />
      </motion.div>

      <div className="relative z-10 flex flex-col gap-6">
        <SystemResources />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <MetricsCards />
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-3">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex flex-col gap-6 lg:col-span-2"
          >
            <div className="relative rounded-xl group">
              <div className="absolute -inset-px bg-gradient-to-b from-primary/20 to-transparent rounded-xl opacity-50 pointer-events-none" />
              <div className="relative border border-neutral-800/80 rounded-xl bg-neutral-950/80 backdrop-blur shadow-xl">
                <AiHealthCard />
              </div>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 backdrop-blur shadow-xl overflow-hidden">
              <PnlChart />
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 backdrop-blur shadow-xl overflow-hidden">
              <RecentActivity />
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col gap-6"
          >
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/80 backdrop-blur shadow-xl overflow-hidden">
              <WorkersOverview />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
