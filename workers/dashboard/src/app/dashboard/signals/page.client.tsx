"use client";

import { SignalsTable } from "@/components/dashboard/signals-table";
import { PageHeader } from "@/components/dashboard/page-header";
import { Zap } from "lucide-react";

export default function SignalsClient() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Zap className="h-8 w-8 text-primary" />}
        title="Trade Signals"
        description="Drill-down view of all trading signals received from external sources"
      />

      <SignalsTable />
    </div>
  );
}
