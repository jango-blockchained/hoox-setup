"use client";

import {
  LayoutDashboard,
  TrendingUp,
  GitBranch,
  ScrollText,
  Settings,
  Wrench,
  Brain,
  ChevronDown,
  BarChart3,
  Database,
  Radio,
  Bell,
  FileText,
} from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useState } from "react";

// Top-level navigation: rendered as a flat list at the top of the sidebar.
const primaryItems = [
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
    title: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
];

// "Tools" group: data inspection, notifications, and report retrieval.
// Grouped visually so the sidebar doesn't read as one long list of 12 items.
const toolsItems = [
  {
    title: "Database",
    href: "/dashboard/database",
    icon: Database,
  },
  {
    title: "Signals",
    href: "/dashboard/signals",
    icon: Radio,
  },
  {
    title: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
  },
  {
    title: "Reports",
    href: "/dashboard/reports",
    icon: FileText,
  },
];

// Tail of the sidebar: ops, system, AI agent, settings.
const tailItems = [
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
    ],
  },
  {
    title: "Settings",
    href: "/dashboard/settings",
    icon: Settings,
  },
];

interface NavItem {
  title: string;
  href?: string;
  icon: typeof LayoutDashboard;
  children?: { title: string; href: string }[];
}

function renderItem(
  item: NavItem,
  pathname: string | null,
  expandedItem: string | null,
  setExpandedItem: (title: string | null) => void
) {
  const isActive =
    pathname === item.href ||
    (item.href !== "/dashboard" && pathname?.startsWith(item.href ?? ""));

  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedItem === item.title;

  return (
    <div key={item.href || item.title}>
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={isActive}
          className="transition-colors"
          onClick={() =>
            hasChildren && setExpandedItem(isExpanded ? null : item.title)
          }
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
            <Link href={item.href ?? "#"}>
              <item.icon />
              <span>{item.title}</span>
            </Link>
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
      {hasChildren && isExpanded && (
        <SidebarMenuSub>
          {item.children?.map((child) => (
            <SidebarMenuSubItem key={child.href}>
              <SidebarMenuSubButton asChild isActive={pathname === child.href}>
                <Link href={child.href}>{child.title}</Link>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      )}
    </div>
  );
}

export function NavMain() {
  const pathname = usePathname();
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  return (
    <>
      <SidebarMenu>
        {primaryItems.map((item) =>
          renderItem(item, pathname, expandedItem, setExpandedItem)
        )}
      </SidebarMenu>

      <SidebarGroup>
        <SidebarGroupLabel>Tools</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {toolsItems.map((item) =>
              renderItem(item, pathname, expandedItem, setExpandedItem)
            )}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarMenu>
        {tailItems.map((item) =>
          renderItem(item, pathname, expandedItem, setExpandedItem)
        )}
      </SidebarMenu>
    </>
  );
}
