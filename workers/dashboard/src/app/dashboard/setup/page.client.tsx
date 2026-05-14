"use client";

import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { DeployedInfrastructure } from "@/components/dashboard/deployed-infrastructure";
import { PageHeader } from "@/components/dashboard/page-header";
import { Wrench } from "lucide-react";

export default function SetupClient() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <PageHeader
        as="h2"
        icon={<Wrench className="h-8 w-8 text-primary" />}
        title="Setup Validation"
      />
      <DeployedInfrastructure />
      <SetupChecklist />
    </div>
  );
}
