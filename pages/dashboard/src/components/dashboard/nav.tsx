"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  TrendingUp, 
  ScrollText, 
  Settings,
  Boxes,
  GitBranch,
  Wrench
} from "lucide-react"

const nav_items = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Setup",
    href: "/dashboard/setup",
    icon: Wrench,
  },
  {
    title: "Signal Flow",
    href: "/dashboard/signal-flow",
    icon: GitBranch,
  },
  {
    title: "Positions",
    href: "/dashboard/positions",
    icon: TrendingUp,
  },
  {
    title: "Logs",
    href: "/dashboard/logs",
    icon: ScrollText,
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-sidebar lg:block">
      <nav className="flex flex-col gap-1 p-4">
        {nav_items.map((item) => {
          const isActive = pathname === item.href || 
            (item.href !== "/dashboard" && pathname?.startsWith(item.href))
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.title}
            </Link>
          )
        })}
        
        <div className="my-4 border-t border-border" />
        
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Boxes className="h-3.5 w-3.5" />
            <span>Connected Workers</span>
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {["hoox", "trade-worker", "d1-worker", "agent-worker", "telegram-worker"].map((worker) => (
              <div key={worker} className="flex items-center gap-2 px-1 py-0.5 text-xs">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                <span className="text-muted-foreground">{worker}</span>
              </div>
            ))}
          </div>
        </div>
      </nav>
    </aside>
  )
}
