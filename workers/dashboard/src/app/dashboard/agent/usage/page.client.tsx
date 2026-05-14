"use client";

import { UsageChart } from "@/components/agent/usage-chart";
import { UsageTable } from "@/components/agent/usage-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { BarChart3 } from "lucide-react";

export default function UsageClient() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<BarChart3 className="h-8 w-8 text-primary" />}
        title="Usage Statistics"
        description="AI API consumption"
      />

      <UsageChart />
      <UsageTable />
    </div>
  );
}
