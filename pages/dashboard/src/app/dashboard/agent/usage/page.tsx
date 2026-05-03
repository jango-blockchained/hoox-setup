"use client";

import { UsageChart } from "@/components/agent/usage-chart";
import { UsageTable } from "@/components/agent/usage-table";
import { BarChart3 } from "lucide-react";
import { motion } from "framer-motion";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function UsagePage() {
  return (
    <div className="flex flex-col gap-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-center gap-3">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
          <BarChart3 className="h-8 w-8 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Usage Statistics</h1>
          <p className="text-sm text-muted-foreground">AI API consumption</p>
        </div>
      </motion.div>

      <UsageChart />
      <UsageTable />
    </div>
  );
}
