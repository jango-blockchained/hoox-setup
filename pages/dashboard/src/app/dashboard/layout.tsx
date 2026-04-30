import { DashboardHeader } from "@/components/dashboard/header"
import { LiveTicker } from "@/components/dashboard/live-ticker"
import { CommandPalette } from "@/components/dashboard/command-palette"
import { AmbientBackground } from "@/components/dashboard/ambient-background"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/dashboard/sidebar"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Dashboard | Hoox Trading System",
  description:
    "Monitor your trading system in real-time. View positions, signals, and system health.",
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AmbientBackground>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <DashboardHeader />
          <LiveTicker />
          <main className="flex-1 p-4 pt-2 sm:p-6 lg:p-8">
            {children}
          </main>
          <CommandPalette />
        </SidebarInset>
      </SidebarProvider>
    </AmbientBackground>
  )
}
