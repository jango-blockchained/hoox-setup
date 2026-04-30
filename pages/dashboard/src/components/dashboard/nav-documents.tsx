"use client"

import {
  Database,
  FileText,
  BarChart3,
} from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from "@/components/ui/sidebar"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { MoreHorizontal } from "lucide-react"
import { useSidebar } from "@/components/ui/sidebar"

const documents = [
  {
    name: "Trade Signals",
    href: "/dashboard/logs",
    icon: FileText,
  },
  {
    name: "Analytics",
    href: "/dashboard",
    icon: BarChart3,
  },
  {
    name: "Database",
    href: "#",
    icon: Database,
  },
]

export function NavDocuments({
  className,
  ...props
}: React.ComponentProps<typeof SidebarGroup>) {
  const { isMobile } = useSidebar()

  return (
    <SidebarGroup className={className} {...props}>
      <SidebarGroupLabel>Documents</SidebarGroupLabel>
      <SidebarMenu>
        {documents.map((item) => (
          <SidebarMenuItem key={item.name}>
            <SidebarMenuButton asChild>
              <a href={item.href}>
                <item.icon />
                <span>{item.name}</span>
              </a>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction
                  showOnHover
                  className="rounded-sm data-[state=open]:bg-accent"
                >
                  <MoreHorizontal />
                  <span className="sr-only">More</span>
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-24 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align={isMobile ? "end" : "start"}
              >
                <DropdownMenuItem>
                  <span>Open</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <span>Share</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <span>Delete</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  )
}
