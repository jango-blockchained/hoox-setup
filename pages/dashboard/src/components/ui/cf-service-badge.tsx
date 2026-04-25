import React from "react"
import {
  Database,
  Key,
  Archive,
  ListOrdered,
  Brain,
  Network,
  Clock,
  Shield,
  Link,
  Globe
} from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Badge } from "@/components/ui/badge"
import { motion } from "framer-motion"

export type CFServiceType = 
  | "D1" 
  | "KV" 
  | "R2" 
  | "Queues" 
  | "Workers AI" 
  | "Vectorize" 
  | "Durable Objects" 
  | "Rate Limiting" 
  | "Service Binding"
  | "Browser Rendering"

interface CFServiceDef {
  name: string
  description: string
  icon: React.ElementType
  colorClass: string
  bgColorClass: string
}

export const CF_SERVICES: Record<CFServiceType, CFServiceDef> = {
  "D1": {
    name: "D1",
    description: "Serverless SQL Database",
    icon: Database,
    colorClass: "text-[#F6821F]",
    bgColorClass: "bg-gradient-to-r from-[#F6821F]/15 to-[#F6821F]/5 border-[#F6821F]/30"
  },
  "KV": {
    name: "KV",
    description: "Global Key-Value Store",
    icon: Key,
    colorClass: "text-[#F6821F]",
    bgColorClass: "bg-gradient-to-r from-[#F6821F]/15 to-[#F6821F]/5 border-[#F6821F]/30"
  },
  "R2": {
    name: "R2",
    description: "Object Storage",
    icon: Archive,
    colorClass: "text-[#F6821F]",
    bgColorClass: "bg-gradient-to-r from-[#F6821F]/15 to-[#F6821F]/5 border-[#F6821F]/30"
  },
  "Queues": {
    name: "Queues",
    description: "Message Queuing",
    icon: ListOrdered,
    colorClass: "text-[#F6821F]",
    bgColorClass: "bg-gradient-to-r from-[#F6821F]/15 to-[#F6821F]/5 border-[#F6821F]/30"
  },
  "Workers AI": {
    name: "Workers AI",
    description: "Serverless GPU Inference",
    icon: Brain,
    colorClass: "text-[#8727FF]",
    bgColorClass: "bg-gradient-to-r from-[#8727FF]/15 to-[#8727FF]/5 border-[#8727FF]/30"
  },
  "Vectorize": {
    name: "Vectorize",
    description: "Vector Database",
    icon: Network,
    colorClass: "text-[#8727FF]",
    bgColorClass: "bg-gradient-to-r from-[#8727FF]/15 to-[#8727FF]/5 border-[#8727FF]/30"
  },
  "Durable Objects": {
    name: "Durable Objects",
    description: "Strong Consistency & State",
    icon: Clock,
    colorClass: "text-[#F6821F]",
    bgColorClass: "bg-gradient-to-r from-[#F6821F]/15 to-[#F6821F]/5 border-[#F6821F]/30"
  },
  "Rate Limiting": {
    name: "Rate Limiting",
    description: "DDoS Protection & Traffic Control",
    icon: Shield,
    colorClass: "text-[#F6821F]",
    bgColorClass: "bg-gradient-to-r from-[#F6821F]/15 to-[#F6821F]/5 border-[#F6821F]/30"
  },
  "Service Binding": {
    name: "Service Binding",
    description: "Zero-Latency Worker-to-Worker Comm",
    icon: Link,
    colorClass: "text-[#F6821F]",
    bgColorClass: "bg-gradient-to-r from-[#F6821F]/15 to-[#F6821F]/5 border-[#F6821F]/30"
  },
  "Browser Rendering": {
    name: "Browser Rendering",
    description: "Headless Browser Automation",
    icon: Globe,
    colorClass: "text-[#F6821F]",
    bgColorClass: "bg-gradient-to-r from-[#F6821F]/15 to-[#F6821F]/5 border-[#F6821F]/30"
  }
}

interface CFServiceBadgeProps {
  service: CFServiceType
  isActive?: boolean
  mini?: boolean
}

export function CFServiceBadge({ service, isActive = false, mini = false }: CFServiceBadgeProps) {
  const def = CF_SERVICES[service]
  if (!def) return null

  const Icon = def.icon

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            animate={isActive ? { scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="inline-block"
          >
            <Badge 
              variant="outline" 
              className={`
                transition-all duration-300 
                ${def.bgColorClass} 
                ${def.colorClass}
                ${mini ? "px-2.5 py-1 text-[11px] gap-1.5" : "px-4 py-1.5 text-sm gap-2"}
                ${isActive ? "shadow-[0_0_8px_rgba(246,130,31,0.3)]" : ""}
                hover:opacity-100 hover:scale-[1.03] hover:-translate-y-0.5 hover:shadow-md cursor-help
              `}
            >
              <Icon className={mini ? "h-3.5 w-3.5" : "h-5 w-5"} />
              <span className="font-medium tracking-tight whitespace-nowrap">{def.name}</span>
            </Badge>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] p-2 bg-popover/95 backdrop-blur border-border">
          <div className="flex items-center gap-2 mb-1">
            <div className={`h-1.5 w-1.5 rounded-full ${isActive ? 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)] animate-pulse' : 'bg-emerald-500'}`} />
            <p className="text-xs font-semibold">{def.name}</p>
          </div>
          <p className="text-[10px] text-muted-foreground">{def.description}</p>
          <p className="text-[9px] text-muted-foreground/80 mt-1 font-mono">{isActive ? 'Status: Active / Routing' : 'Status: Operational'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}