"use client";

import { KillSwitch } from "@/components/agent/kill-switch";
import { RiskParameters } from "@/components/agent/risk-parameters";
import { TrailingStops } from "@/components/agent/trailing-stops";
import { Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { toast } from "@/components/ui/sonner";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function RiskPage() {
  const [killSwitchActive, setKillSwitchActive] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    try {
      const res = await fetch("/api/agent/status");
      const data = await res.json();
      if (data.success) { setKillSwitchActive(data.status?.killSwitch || false); }
    } catch (e) { toast.error("Failed to fetch status"); } 
    finally { setLoading(false); }
  };

  useEffect(() => { fetchStatus(); }, []);

  const handleToggleKillSwitch = async (action: 'engage_kill_switch' | 'release_kill_switch') => {
    try {
      const res = await fetch("/api/agent/risk-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) { toast.success(data.message); fetchStatus(); } 
      else { toast.error(data.error || "Action failed"); }
    } catch (e) { toast.error("Failed to toggle kill switch"); }
  };

  return (
    <div className="flex flex-col gap-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-center gap-3">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
          <Shield className="h-8 w-8 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Risk Management</h1>
          <p className="text-sm text-muted-foreground">Parameters & overrides</p>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="h-32 bg-secondary/30 rounded-lg animate-pulse" />
          <div className="h-64 bg-secondary/30 rounded-lg animate-pulse" />
          <div className="h-48 bg-secondary/30 rounded-lg animate-pulse" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <KillSwitch active={killSwitchActive} onToggle={handleToggleKillSwitch} />
            <RiskParameters />
          </div>
          <TrailingStops />
        </div>
      )}
    </div>
  );
}
