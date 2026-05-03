"use client"

import {
  LayoutDashboard,
  TrendingUp,
  GitBranch,
  ScrollText,
  Settings,
  Wrench,
  Brain,
  ChevronDown,
} from "lucide-react"
import { SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem } from "@/components/ui/sidebar"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useState } from "react"

const navItems = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Positions",
    href: "/dashboard/positions",
    icon: TrendingUp,
  },
  {
    title: "Signal Flow",
    href: "/dashboard/signal-flow",
    icon: GitBranch,
  },
  {
    title: "Logs",
    href: "/dashboard/logs",
    icon: ScrollText,
  },
  {
    title: "Setup",
    href: "/dashboard/setup",
    icon: Wrench,
  },
  {
    title: "Agent",
    icon: Brain,
    href: "/dashboard/agent",
    children: [
      { title: "Overview", href: "/dashboard/agent" },
      { title: "Chat", href: "/dashboard/agent/chat" },
      { title: "Vision", href: "/dashboard/agent/vision" },
      { title: "Reasoning", href: "/dashboard/agent/reasoning" },
      { title: "Models", href: "/dashboard/agent/models" },
      { title: "Risk", href: "/dashboard/agent/risk" },
      { title: "Usage", href: "/dashboard/agent/usage" },
    ]
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
]

export function NavMain() {
  const pathname = usePathname()
  const [expandedItem, setExpandedItem] = useState<string | null>(null)

  return (
    <SidebarMenu>
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/dashboard" && pathname?.startsWith(item.href))
        
        const hasChildren = item.children && item.children.length > 0
        const isExpanded = expandedItem === item.title

        return (
          <div key={item.href || item.title}>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                className="transition-colors"
                onClick={() => hasChildren && setExpandedItem(isExpanded ? null : item.title)}
              >
                {hasChildren ? (
                  <button className="flex items-center w-full">
                    <item.icon />
                    <span>{item.title}</span>
                    <ChevronDown 
                      className={cn(
                        "ml-auto h-4 w-4 transition-transform",
                        isExpanded && "rotate-180"
                      )} 
                    />
                  </button>
                ) : (
                  <Link href={item.href}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
            {hasChildren && isExpanded && (
              <SidebarMenuSub>
                {item.children.map((child) => (
                  <SidebarMenuSubItem key={child.href}>
                    <SidebarMenuSubButton asChild isActive={pathname === child.href}>
                      <Link href={child.href}>{child.title}</Link>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            )}
          </div>
        )
      })}
    </SidebarMenu>
  )
}
