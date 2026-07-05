"use client";

import {
  Bell,
  Database,
  ExternalLink,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";

// Secondary navigation links surfaced in the sidebar.
// Each href must be a real, routable page — no `#` placeholders and no
// duplicates of routes already in `NavMain` (Overview points to /dashboard).
const quickLinks = [
  {
    name: "Trade Signals",
    href: "/dashboard/logs",
    icon: FileText,
  },
  {
    name: "Database",
    href: "/dashboard/database",
    icon: Database,
  },
  {
    name: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
  },
];

export function NavDocuments({
  className,
  ...props
}: React.ComponentProps<typeof SidebarGroup>) {
  const { isMobile } = useSidebar();
  const pathname = usePathname();

  return (
    <SidebarGroup className={className} {...props}>
      <SidebarGroupLabel>Quick Links</SidebarGroupLabel>
      <SidebarMenu>
        {quickLinks.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" &&
              Boolean(pathname?.startsWith(`${item.href}/`)));

          return (
            <SidebarMenuItem key={item.name}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={item.name}
                className="transition-colors"
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.name}</span>
                </Link>
              </SidebarMenuButton>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuAction
                    showOnHover
                    className="rounded-sm data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
                  >
                    <MoreHorizontal />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-48 rounded-lg"
                  side={isMobile ? "bottom" : "right"}
                  align={isMobile ? "end" : "start"}
                >
                  <DropdownMenuItem asChild>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2"
                      )}
                    >
                      <item.icon className="text-muted-foreground" />
                      <span>Open</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-2"
                      )}
                    >
                      <ExternalLink className="text-muted-foreground" />
                      <span>Open in new tab</span>
                    </a>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
