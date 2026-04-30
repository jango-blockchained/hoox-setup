import { DashboardNav } from "@/components/dashboard/nav";
import { DashboardHeader } from "@/components/dashboard/header";
import { LiveTicker } from "@/components/dashboard/live-ticker";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { AmbientBackground } from "@/components/dashboard/ambient-background";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AmbientBackground>
      <div className="min-h-screen bg-background">
        <CommandPalette />
        <DashboardHeader />
        <LiveTicker />
        <div className="flex">
          <DashboardNav />
          <main className="flex-1 p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </AmbientBackground>
  );
}
