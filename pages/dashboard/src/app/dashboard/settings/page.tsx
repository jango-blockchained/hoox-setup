'use client';

import { SettingsForm } from "@/components/dashboard/settings-form"
import { Settings } from "lucide-react"
import { motion } from "framer-motion"

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
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
          <Settings className="h-8 w-8 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Configure your trading system and worker settings
          </p>
        </div>
      </motion.div>
      <SettingsForm />
    </div>
  )
}
