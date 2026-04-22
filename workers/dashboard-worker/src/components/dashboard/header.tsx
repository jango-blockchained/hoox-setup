"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Activity, ExternalLink, Code2, Zap, Wifi, WifiOff, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { MobileNav } from "./mobile-nav"
import { motion } from "framer-motion"

export function DashboardHeader() {
  const [isOnline, setIsOnline] = useState(true)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [latency, setLatency] = useState(12)

  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    const latencyInterval = setInterval(() => {
      setLatency(Math.floor(Math.random() * 20) + 5)
    }, 5000)

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      clearInterval(timeInterval)
      clearInterval(latencyInterval)
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  return (
    <TooltipProvider>
      <header className="sticky top-0 z-50 border-b border-border bg-sidebar/95 backdrop-blur supports-[backdrop-filter]:bg-sidebar/80">
        <div className="flex h-14 items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <MobileNav />
            <Link href="/dashboard" className="flex items-center gap-2 group">
              <motion.div 
                className="flex h-8 w-8 items-center justify-center rounded-md bg-primary transition-transform group-hover:scale-105"
                whileHover={{ rotate: 5 }}
              >
                <Zap className="h-5 w-5 text-primary-foreground" />
              </motion.div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">Hoox</span>
                <span className="text-[10px] text-muted-foreground">Edge Trading</span>
              </div>
            </Link>
            
            {/* Status Indicators */}
            <div className="hidden items-center gap-3 md:flex">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 rounded-md bg-secondary/50 px-2.5 py-1">
                    {isOnline ? (
                      <>
                        <motion.div
                          animate={{ scale: [1, 1.2, 1] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          <Wifi className="h-3 w-3 text-success" />
                        </motion.div>
                        <span className="text-xs text-muted-foreground">Online</span>
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3 text-destructive" />
                        <span className="text-xs text-destructive">Offline</span>
                      </>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Connection Status</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="secondary" className="gap-1.5 font-mono text-[10px]">
                    <Activity className="h-3 w-3 text-success" />
                    {latency}ms
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>API Latency</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span className="font-mono">
                      {currentTime.toLocaleTimeString("en-US", { 
                        hour: "2-digit", 
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false 
                      })}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Local Time</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="hidden gap-2 text-muted-foreground md:flex" asChild>
              <a href="https://github.com/jango-blockchained/hoox-setup" target="_blank" rel="noopener noreferrer">
                <Code2 className="h-4 w-4" />
                <span>Source</span>
              </a>
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">Visit</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <a href="https://hoox.cryptolinx.workers.dev" target="_blank" rel="noopener noreferrer">
                    Live Gateway
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a href="https://dash.cloudflare.com" target="_blank" rel="noopener noreferrer">
                    Cloudflare Dashboard
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </TooltipProvider>
  )
}
