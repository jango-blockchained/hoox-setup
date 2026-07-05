import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  TrendingUp,
  GitBranch,
  BarChart3,
  ScrollText,
  Radio,
  Bell,
  FileText,
  Database,
  Brain,
  Wrench,
  Settings,
  HelpCircle,
  Search,
} from "lucide-react";

// --- Types ---

export interface NavChildItem {
  title: string;
  href: string;
}

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  children?: NavChildItem[];
}

export interface NavFooterItem {
  title: string;
  href: string;
  icon: LucideIcon;
  external?: boolean;
}

// --- Primary Navigation ---

export const primaryNavItems: NavItem[] = [
  { title: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { title: "Positions", href: "/dashboard/positions", icon: TrendingUp },
  { title: "Signal Flow", href: "/dashboard/signal-flow", icon: GitBranch },
  { title: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
];

// --- Monitoring ---

export const monitoringNavItems: NavItem[] = [
  { title: "Logs", href: "/dashboard/logs", icon: ScrollText },
  { title: "Signals", href: "/dashboard/signals", icon: Radio },
  { title: "Notifications", href: "/dashboard/notifications", icon: Bell },
  { title: "Reports", href: "/dashboard/reports", icon: FileText },
];

// --- System ---

export const systemNavItems: NavItem[] = [
  { title: "Database", href: "/dashboard/database", icon: Database },
  {
    title: "Agent",
    href: "/dashboard/agent",
    icon: Brain,
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
  { title: "Settings", href: "/dashboard/settings", icon: Settings },
];

// --- Footer ---

export const footerNavItems: NavFooterItem[] = [
  {
    title: "Get Help",
    href: "https://github.com/jango-blockchained/hoox-setup/issues",
    icon: HelpCircle,
    external: true,
  },
  { title: "Setup", href: "/dashboard/setup", icon: Wrench },
  {
    title: "Search",
    href: "#",
    icon: Search,
  },
];

// --- Active Route Utility ---

export function isActiveRoute(
  pathname: string | null,
  itemHref: string
): boolean {
  if (!pathname) return false;
  if (pathname === itemHref) return true;
  // "/dashboard" should not match every sub-route
  if (itemHref === "/dashboard") return false;
  // Match sub-paths, e.g. /dashboard/agent/chat matches /dashboard/agent
  return pathname.startsWith(itemHref + "/");
}
