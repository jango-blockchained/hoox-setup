'use client';

import { SetupChecklist } from "@/components/dashboard/setup-checklist";
import { DeployedInfrastructure } from "@/components/dashboard/deployed-infrastructure";
import { Wrench } from "lucide-react";
import { motion } from "framer-motion";

export default function SetupPage() {
  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-center gap-3"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
        >
          <Wrench className="h-8 w-8 text-primary" />
        </motion.div>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Setup Validation</h2>
        </div>
      </motion.div>
      <DeployedInfrastructure />
      <SetupChecklist />
    </div>
  );
}