"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Activity, AlertTriangle } from "lucide-react"
import { motion } from "framer-motion"

const WORKERS = ["trade-worker", "agent-worker", "d1-worker", "telegram-worker", "hoox"]

export function WorkerPerformance() {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedWorker, setSelectedWorker] = useState(WORKERS[0])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const url = new URL(`/api/analytics/worker-performance`, window.location.origin)
        url.searchParams.set("worker", selectedWorker)
        const res = await fetch(url.toString())
        const json = await res.json() as { success: boolean; data?: any[] }
        if (json.success) {
          setData(json.data || [])
        }
      } catch (error) {
        console.error("Failed to fetch worker performance:", error)
      } finally {
        setLoading(false)
      }
    }
    if (mounted) fetchData()
  }, [selectedWorker, mounted])

  if (!mounted) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Worker Performance</CardTitle>
                <CardDescription>Request counts, errors, and latency</CardDescription>
              </div>
            </div>
            <Select value={selectedWorker} onValueChange={setSelectedWorker}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WORKERS.map((w) => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[200px] items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : data.length === 0 ? (
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              No performance data available
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data Type</TableHead>
                  <TableHead>Requests</TableHead>
                  <TableHead>Errors</TableHead>
                  <TableHead>Avg Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{row.data_type}</TableCell>
                    <TableCell>{row.total_requests || 0}</TableCell>
                    <TableCell>
                      <span className={row.total_errors > 0 ? "text-red-500" : ""}>
                        {row.total_errors || 0}
                      </span>
                    </TableCell>
                    <TableCell>
                      {row.avg_duration_ms ? `${Math.round(row.avg_duration_ms)}ms` : "N/A"}
                    </TableCell>
                    <TableCell>
                      {row.total_errors > 0 ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Issues
                        </Badge>
                      ) : (
                        <Badge variant="secondary">Healthy</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}
