"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { 
  Plus, 
  Pause, 
  Play, 
  RefreshCw, 
  Download, 
  Settings2,
  Zap,
  ShieldAlert
} from "lucide-react"
import { toast } from "sonner"
import { useState } from "react"

export function QuickActions() {
  const [isTradingActive, setIsTradingActive] = useState(true)

  const handleToggleTrading = () => {
    setIsTradingActive(!isTradingActive)
    toast.success(isTradingActive ? "Trading paused" : "Trading resumed", {
      description: isTradingActive 
        ? "The system will not execute new trades" 
        : "The system will resume executing trades",
    })
  }

  const handleEmergencyStop = () => {
    toast.error("Emergency stop activated", {
      description: "All trading activities have been halted and positions preserved.",
    })
  }

  const handleSyncPositions = () => {
    toast.promise(
      new Promise((resolve) => setTimeout(resolve, 2000)),
      {
        loading: "Syncing positions...",
        success: "Positions synced successfully",
        error: "Failed to sync positions",
      }
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={isTradingActive ? "secondary" : "default"}
        size="sm"
        className="h-8 gap-2"
        onClick={handleToggleTrading}
      >
        {isTradingActive ? (
          <>
            <Pause className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Pause Trading</span>
          </>
        ) : (
          <>
            <Play className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Resume Trading</span>
          </>
        )}
      </Button>
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2">
            <Zap className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={handleSyncPositions}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Sync Positions
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Plus className="mr-2 h-4 w-4" />
            New Manual Trade
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings2 className="mr-2 h-4 w-4" />
            Configure AI
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            className="text-destructive focus:text-destructive"
            onClick={handleEmergencyStop}
          >
            <ShieldAlert className="mr-2 h-4 w-4" />
            Emergency Stop
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
