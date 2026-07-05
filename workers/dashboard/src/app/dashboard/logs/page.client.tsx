"use client";

import { LogsViewer } from "@/components/dashboard/logs-viewer";
import { PageHeader } from "@/components/dashboard/page-header";
import { ScrollText } from "lucide-react";

export default function LogsClient() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<ScrollText className="h-8 w-8 text-primary" />}
        title="System Logs"
        description="Real-time system event stream from all workers"
      />
      <LogsViewer />
    </div>
  );
}
