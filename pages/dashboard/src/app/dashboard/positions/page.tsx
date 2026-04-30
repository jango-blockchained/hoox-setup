'use client';

export const dynamic = "force-dynamic"
export const runtime = "edge"

import { PositionsTable } from "@/components/dashboard/positions-table"
import { CandlestickChart } from "@/components/dashboard/candlestick-chart"
import { TrendingUp } from "lucide-react"
import { motion } from "framer-motion"
import { useState } from "react"

// Mock data for demonstration
const mockCandleData = [
  { time: "2026-04-24", open: 67500, high: 68200, low: 67300, close: 68000 },
  { time: "2026-04-25", open: 68000, high: 68800, low: 67900, close: 68500 },
  { time: "2026-04-26", open: 68500, high: 69200, low: 68400, close: 69100 },
  { time: "2026-04-27", open: 69100, high: 69800, low: 68900, close: 69300 },
  { time: "2026-04-28", open: 69300, high: 70500, low: 69200, close: 70200 },
  { time: "2026-04-29", open: 70200, high: 71200, low: 70100, close: 70900 },
  { time: "2026-04-30", open: 70900, high: 71500, low: 70700, close: 71200 },
]

export default function PositionsPage() {
  const [showChart, setShowChart] = useState(true)

  return (
    <div className="flex flex-col gap-6">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
          >
            <TrendingUp className="h-8 w-8 text-primary" />
          </motion.div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Positions</h1>
            <p className="text-sm text-muted-foreground">
              Manage your active trading positions
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowChart(!showChart)}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {showChart ? 'Hide Chart' : 'Show Chart'}
        </button>
      </motion.div>

      {showChart && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
        >
          <CandlestickChart
            data={mockCandleData}
            title="BTC/USDT Price Action"
            description="Last 7 days candlestick data"
            className="h-[350px]"
          />
        </motion.div>
      )}

      <PositionsTable />
    </div>
  )
}
