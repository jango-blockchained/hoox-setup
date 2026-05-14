"use client";

import { SettingsForm } from "@/components/dashboard/settings-form";
import { PageHeader } from "@/components/dashboard/page-header";
import { Settings } from "lucide-react";

export default function SettingsClient() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={<Settings className="h-8 w-8 text-primary" />}
        title="Settings"
        description="Configure your trading system and worker settings"
      />
      <SettingsForm />
    </div>
  );
}
