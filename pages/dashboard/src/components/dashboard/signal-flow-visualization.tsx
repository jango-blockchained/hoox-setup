"use client"

import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Webhook,
  Split,
  Brain,
  Shield,
  BarChart3,
  Zap,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react"

interface Signal {
  id: string
  symbol: string
  action: "BUY" | "SELL"
  status: "pending" | "processing" | "completed" | "rejected"
  currentStage: number
  startTime: number
  splitInto?: number
  aiScore?: number
  riskApproved?: boolean
  executed?: boolean
}

const stages = [
  {
    id: 0,
    name: "Webhook",
    shortName: "Receive",
    icon: Webhook,
    worker: "webhook-worker",
    description: "Signal received from TradingView",
    color: "from-orange-500 to-amber-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
  },
  {
    id: 1,
    name: "Splitter",
    shortName: "Split",
    icon: Split,
    worker: "splitter-worker",
    description: "Split across exchanges",
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/30",
  },
  {
    id: 2,
    name: "AI Analysis",
    shortName: "Analyze",
    icon: Brain,
    worker: "ai-worker",
    description: "ML model evaluation",
    color: "from-purple-500 to-pink-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/30",
  },
  {
    id: 3,
    name: "Risk Check",
    shortName: "Validate",
    icon: Shield,
    worker: "risk-worker",
    description: "Risk parameters validation",
    color: "from-emerald-500 to-green-500",
    bgColor: "bg-emerald-500/10",
    borderColor: "border-emerald-500/30",
  },
  {
    id: 4,
    name: "Position",
    shortName: "Manage",
    icon: BarChart3,
    worker: "position-worker",
    description: "Position sizing & management",
    color: "from-yellow-500 to-orange-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
  },
  {
    id: 5,
    name: "Execute",
    shortName: "Trade",
    icon: Zap,
    worker: "execution-worker",
    description: "Order execution on exchange",
    color: "from-red-500 to-rose-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
  },
]

const symbols = ["BTC/USDT", "ETH/USDT", "SOL/USDT", "AVAX/USDT", "LINK/USDT"]

function generateSignal(): Signal {
  return {
    id: Math.random().toString(36).substr(2, 9),
    symbol: symbols[Math.floor(Math.random() * symbols.length)],
    action: Math.random() > 0.5 ? "BUY" : "SELL",
    status: "pending",
    currentStage: -1,
    startTime: Date.now(),
  }
}

function SignalParticle({
  signal,
  stageIndex,
  totalStages,
  onComplete,
}: {
  signal: Signal
  stageIndex: number
  totalStages: number
  onComplete: () => void
}) {
  const progress = (stageIndex + 1) / totalStages
  const stage = stages[stageIndex]

  useEffect(() => {
    const timer = setTimeout(onComplete, 800 + Math.random() * 400)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <motion.div
      className="absolute z-20"
      initial={{ left: `${(stageIndex / totalStages) * 100}%`, opacity: 0, scale: 0 }}
      animate={{
        left: `${((stageIndex + 0.5) / totalStages) * 100}%`,
        opacity: 1,
        scale: 1,
      }}
      exit={{
        left: `${((stageIndex + 1) / totalStages) * 100}%`,
        opacity: 0,
        scale: 0,
      }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      style={{ top: "50%", transform: "translateY(-50%)" }}
    >
      <motion.div
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-gradient-to-r ${stage?.color} text-white shadow-lg`}
        animate={{
          boxShadow: [
            "0 0 10px rgba(255,255,255,0.3)",
            "0 0 20px rgba(255,255,255,0.5)",
            "0 0 10px rgba(255,255,255,0.3)",
          ],
        }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        <span className={signal.action === "BUY" ? "text-green-200" : "text-red-200"}>
          {signal.action}
        </span>
        <span>{signal.symbol.split("/")[0]}</span>
      </motion.div>
    </motion.div>
  )
}

function StageNode({
  stage,
  isActive,
  isProcessing,
  stats,
}: {
  stage: (typeof stages)[0]
  isActive: boolean
  isProcessing: boolean
  stats: { processed: number; latency: number }
}) {
  const Icon = stage.icon

  return (
    <motion.div
      className="relative flex flex-col items-center"
      animate={isProcessing ? { scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.5, repeat: isProcessing ? Infinity : 0 }}
    >
      {/* Glow effect */}
      <AnimatePresence>
        {isProcessing && (
          <motion.div
            className={`absolute inset-0 rounded-2xl bg-gradient-to-r ${stage.color} blur-xl opacity-30`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0.2, 0.4, 0.2], scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </AnimatePresence>

      {/* Main node */}
      <motion.div
        className={`relative flex h-16 w-16 items-center justify-center rounded-2xl border-2 transition-all duration-300 ${
          isProcessing
            ? `${stage.bgColor} ${stage.borderColor} shadow-lg`
            : isActive
              ? `${stage.bgColor} ${stage.borderColor}`
              : "bg-secondary/50 border-border"
        }`}
        whileHover={{ scale: 1.1 }}
      >
        <Icon
          className={`h-7 w-7 transition-colors duration-300 ${
            isProcessing || isActive ? "text-foreground" : "text-muted-foreground"
          }`}
        />

        {/* Processing indicator */}
        {isProcessing && (
          <motion.div
            className={`absolute -inset-1 rounded-2xl border-2 ${stage.borderColor}`}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </motion.div>

      {/* Stage name */}
      <span className="mt-2 text-xs font-medium text-foreground">{stage.shortName}</span>

      {/* Stats */}
      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
        <span>{stats.processed}</span>
        <span className="text-muted-foreground/50">|</span>
        <span>{stats.latency}ms</span>
      </div>
    </motion.div>
  )
}

function ConnectionLine({
  fromStage,
  toStage,
  isActive,
  hasSignal,
}: {
  fromStage: number
  toStage: number
  isActive: boolean
  hasSignal: boolean
}) {
  return (
    <div className="relative flex-1 flex items-center justify-center px-1">
      {/* Background line */}
      <div className="absolute h-0.5 w-full bg-border/50 rounded-full" />

      {/* Active line */}
      <motion.div
        className={`absolute h-0.5 rounded-full bg-gradient-to-r ${stages[fromStage].color}`}
        initial={{ width: "0%" }}
        animate={{ width: isActive ? "100%" : "0%" }}
        transition={{ duration: 0.3 }}
      />

      {/* Arrow */}
      <ArrowRight
        className={`relative z-10 h-4 w-4 transition-colors duration-300 ${
          isActive ? "text-foreground" : "text-muted-foreground/30"
        }`}
      />

      {/* Signal pulse */}
      <AnimatePresence>
        {hasSignal && (
          <motion.div
            className={`absolute h-2 w-2 rounded-full bg-gradient-to-r ${stages[fromStage].color}`}
            initial={{ left: "0%", opacity: 1 }}
            animate={{ left: "100%", opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "linear" }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

export function SignalFlowVisualization() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [isRunning, setIsRunning] = useState(true)
  const [stageStats, setStageStats] = useState(
    stages.map(() => ({ processed: 0, latency: Math.floor(Math.random() * 30) + 10 }))
  )
  const [completedSignals, setCompletedSignals] = useState<{
    successful: number
    rejected: number
  }>({ successful: 0, rejected: 0 })

  // Process signals through stages
  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      setSignals((prev) => {
        const updated = prev.map((signal) => {
          if (signal.currentStage < stages.length - 1) {
            const nextStage = signal.currentStage + 1

            // Random rejection at risk stage
            if (nextStage === 3 && Math.random() < 0.15) {
              return { ...signal, status: "rejected" as const, riskApproved: false }
            }

            // Update stats
            setStageStats((stats) =>
              stats.map((s, i) =>
                i === nextStage
                  ? {
                      processed: s.processed + 1,
                      latency: Math.floor(Math.random() * 30) + 10,
                    }
                  : s
              )
            )

            // Add AI score at AI stage
            if (nextStage === 2) {
              return {
                ...signal,
                currentStage: nextStage,
                aiScore: Math.floor(Math.random() * 30) + 70,
              }
            }

            // Mark as completed at final stage
            if (nextStage === stages.length - 1) {
              setCompletedSignals((c) => ({ ...c, successful: c.successful + 1 }))
              return {
                ...signal,
                currentStage: nextStage,
                status: "completed" as const,
                executed: true,
              }
            }

            return { ...signal, currentStage: nextStage, status: "processing" as const }
          }
          return signal
        })

        // Remove completed/rejected signals after delay
        return updated.filter(
          (s) =>
            !(
              (s.status === "completed" || s.status === "rejected") &&
              Date.now() - s.startTime > 5000
            )
        )
      })
    }, 600)

    return () => clearInterval(interval)
  }, [isRunning])

  // Generate new signals
  useEffect(() => {
    if (!isRunning) return

    const interval = setInterval(() => {
      if (signals.length < 5) {
        setSignals((prev) => [...prev, generateSignal()])
      }
    }, 2000 + Math.random() * 2000)

    return () => clearInterval(interval)
  }, [isRunning, signals.length])

  // Start initial signal
  useEffect(() => {
    if (signals.length === 0 && isRunning) {
      setSignals([generateSignal()])
    }
  }, [signals.length, isRunning])

  const handleReset = useCallback(() => {
    setSignals([])
    setStageStats(stages.map(() => ({ processed: 0, latency: Math.floor(Math.random() * 30) + 10 })))
    setCompletedSignals({ successful: 0, rejected: 0 })
  }, [])

  const activeStages = new Set(signals.map((s) => s.currentStage))
  const processingStages = new Set(
    signals.filter((s) => s.status === "processing").map((s) => s.currentStage)
  )

  return (
    <Card className="overflow-hidden border-border bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-semibold">Signal Flow Pipeline</CardTitle>
            <p className="text-sm text-muted-foreground">
              Real-time visualization of signal processing through workers
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Stats badges */}
            <Badge variant="outline" className="gap-1 border-emerald-500/30 text-emerald-500">
              <CheckCircle2 className="h-3 w-3" />
              {completedSignals.successful}
            </Badge>
            <Badge variant="outline" className="gap-1 border-red-500/30 text-red-500">
              <XCircle className="h-3 w-3" />
              {completedSignals.rejected}
            </Badge>

            {/* Controls */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsRunning(!isRunning)}
              className="gap-1.5"
            >
              {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {isRunning ? "Pause" : "Play"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Main visualization */}
        <div className="relative rounded-xl border border-border bg-secondary/20 p-6">
          {/* Stage nodes and connections */}
          <div className="flex items-center justify-between">
            {stages.map((stage, index) => (
              <div key={stage.id} className="flex items-center" style={{ flex: index < stages.length - 1 ? 1 : 0 }}>
                <StageNode
                  stage={stage}
                  isActive={activeStages.has(index) || stageStats[index].processed > 0}
                  isProcessing={processingStages.has(index)}
                  stats={stageStats[index]}
                />
                {index < stages.length - 1 && (
                  <ConnectionLine
                    fromStage={index}
                    toStage={index + 1}
                    isActive={stageStats[index].processed > 0}
                    hasSignal={signals.some((s) => s.currentStage === index && s.status === "processing")}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Active signals queue */}
          <div className="mt-6 flex items-center gap-3">
            <span className="text-xs font-medium text-muted-foreground">Active Signals:</span>
            <div className="flex flex-wrap gap-2">
              <AnimatePresence mode="popLayout">
                {signals.map((signal) => (
                  <motion.div
                    key={signal.id}
                    initial={{ opacity: 0, scale: 0.8, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -10 }}
                    layout
                  >
                    <Badge
                      variant="outline"
                      className={`gap-1.5 ${
                        signal.status === "completed"
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-500"
                          : signal.status === "rejected"
                            ? "border-red-500/30 bg-red-500/10 text-red-500"
                            : signal.action === "BUY"
                              ? "border-emerald-500/30 text-emerald-500"
                              : "border-red-500/30 text-red-500"
                      }`}
                    >
                      {signal.status === "completed" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : signal.status === "rejected" ? (
                        <XCircle className="h-3 w-3" />
                      ) : (
                        <motion.div
                          className="h-1.5 w-1.5 rounded-full bg-current"
                          animate={{ opacity: [1, 0.3, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                        />
                      )}
                      <span className="font-medium">{signal.action}</span>
                      <span className="text-muted-foreground">{signal.symbol.split("/")[0]}</span>
                      {signal.aiScore && (
                        <span className="text-purple-400">AI:{signal.aiScore}%</span>
                      )}
                      <span className="text-muted-foreground/60">
                        @{stages[Math.max(0, signal.currentStage)]?.shortName || "Queue"}
                      </span>
                    </Badge>
                  </motion.div>
                ))}
              </AnimatePresence>
              {signals.length === 0 && (
                <span className="text-xs text-muted-foreground">No active signals</span>
              )}
            </div>
          </div>
        </div>

        {/* Worker details grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stages.map((stage, index) => {
            const stats = stageStats[index]
            const isActive = processingStages.has(index)
            const Icon = stage.icon

            return (
              <motion.div
                key={stage.id}
                className={`rounded-lg border p-3 transition-all ${
                  isActive
                    ? `${stage.bgColor} ${stage.borderColor}`
                    : "border-border bg-secondary/30"
                }`}
                animate={isActive ? { scale: [1, 1.02, 1] } : {}}
                transition={{ duration: 0.5 }}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isActive ? "text-foreground" : "text-muted-foreground"}`} />
                  <span className="text-xs font-medium">{stage.name}</span>
                </div>
                <div className="mt-2 text-lg font-bold tabular-nums">{stats.processed}</div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>processed</span>
                  <span className="tabular-nums">{stats.latency}ms</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
