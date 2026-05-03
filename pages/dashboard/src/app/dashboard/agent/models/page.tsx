"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModelConfig } from "@/components/agent/model-config";
import { HealthCheck } from "@/components/agent/health-check";
import { TestModel } from "@/components/agent/test-model";
import { Settings } from "lucide-react";
import { motion } from "framer-motion";

export const dynamic = "force-dynamic";
export const runtime = "edge";

export default function ModelsPage() {
  return (
    <div className="flex flex-col gap-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex items-center gap-3">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }}>
          <Settings className="h-8 w-8 text-primary" />
        </motion.div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">AI Models</h1>
          <p className="text-sm text-muted-foreground">Provider configuration and testing</p>
        </div>
      </motion.div>
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config">Provider Config</TabsTrigger>
          <TabsTrigger value="health">Health Check</TabsTrigger>
          <TabsTrigger value="test">Test Model</TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="mt-4"><ModelConfig /></TabsContent>
        <TabsContent value="health" className="mt-4"><HealthCheck /></TabsContent>
        <TabsContent value="test" className="mt-4"><TestModel /></TabsContent>
      </Tabs>
    </div>
  );
}
