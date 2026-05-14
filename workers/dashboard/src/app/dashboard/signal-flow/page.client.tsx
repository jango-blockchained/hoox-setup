"use client";

import { SignalFlowVisualization } from "@/components/dashboard/signal-flow-visualization";
import { PageHeader } from "@/components/dashboard/page-header";
import { GitBranch } from "lucide-react";

export default function SignalFlowClient() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<GitBranch className="h-8 w-8 text-primary" />}
        title="Signal Flow Pipeline"
        description="Real-time visualization of signal processing through workers"
      />

      <SignalFlowVisualization />
    </div>
  );
}
