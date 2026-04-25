import { Metadata } from "next";
import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { DeployedInfrastructure } from "@/components/dashboard/deployed-infrastructure";

export const metadata: Metadata = {
  title: "Setup | Hoox Dashboard",
  description: "Check your Hoox configuration and secrets",
};

export default function SetupPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Setup Validation</h2>
      </div>
      <DeployedInfrastructure />
      <SetupChecklist />
    </div>
  );
}