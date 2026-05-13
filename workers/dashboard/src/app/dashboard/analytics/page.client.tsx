"use client";

import { TradeMetricsChart } from "@/components/dashboard/analytics/trade-metrics-chart";
import { SuccessRateCard } from "@/components/dashboard/analytics/success-rate-card";
import { WorkerPerformance } from "@/components/dashboard/analytics/worker-performance";
import { ApiStats } from "@/components/dashboard/analytics/api-stats";
import { SignalOutcomes } from "@/components/dashboard/analytics/signal-outcomes";
import { BarChart3, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { Suspense } from "react";

export default function AnalyticsClient() {
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
          <BarChart3 className="h-8 w-8 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Monitor trading system performance, API calls, and signal outcomes
          </p>
        </div>
      </motion.div>

      <div className="grid gap-6 md:grid-cols-2">
        <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}>
          <SuccessRateCard />
        </Suspense>
        <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}>
          <TradeMetricsChart />
        </Suspense>
      </div>

      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted" />}>
        <WorkerPerformance />
      </Suspense>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}>
        <ApiStats />
      </Suspense>
      <Suspense fallback={<div className="h-48 animate-pulse rounded-lg bg-muted" />}>
        <SignalOutcomes />
      </Suspense>
    </div>
  );
}
