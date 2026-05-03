### Task 11: Models Page with Tabs

**Files:**
- Create: `src/app/dashboard/agent/models/page.tsx`
- Create: `src/components/agent/model-config.tsx`
- Create: `src/components/agent/health-check.tsx`
- Create: `src/components/agent/test-model.tsx`

- [ ] **Step 1: Create model-config.tsx component**

```tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { FieldGroup } from "@/components/ui/field";
import { toast } from "sonner";
import { useState } from "react";

const PROVIDERS = ["workers-ai", "openai", "anthropic", "google", "azure"];

export function ModelConfig() {
  const [defaultProvider, setDefaultProvider] = useState("workers-ai");
  const [fallbackChain, setFallbackChain] = useState(["workers-ai", "openai"]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/agent/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultProvider,
          fallbackChain,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Configuration saved");
      } else {
        toast.error(data.error || "Save failed");
      }
    } catch (e) {
      toast.error("Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Provider Configuration</CardTitle>
        <CardDescription>Configure AI provider settings</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Default Provider</FieldLabel>
            <Select value={defaultProvider} onValueChange={setDefaultProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>Primary AI provider for agent operations</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Fallback Chain</FieldLabel>
            <div className="flex gap-2 flex-wrap">
              {fallbackChain.map((p, i) => (
                <div key={i} className="px-3 py-1.5 rounded-lg bg-secondary text-sm">
                  {p}
                </div>
              ))}
            </div>
            <FieldDescription>Providers tried in order on failure</FieldDescription>
          </Field>

          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? (
              <>
                <Spinner className="h-4 w-4" data-icon="inline-start" />
                Saving...
              </>
            ) : (
              "Save Configuration"
            )}
          </Button>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create health-check.tsx component**

```tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

interface ProviderHealth {
  name: string;
  healthy: boolean;
  latency?: number;
  error?: string;
}

export function HealthCheck() {
  const [providers, setProviders] = useState<ProviderHealth[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const fetchHealth = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/agent/health");
      const data = await res.json();
      if (data.success) {
        setProviders(
          Object.entries(data.providers).map(([name, info]: [string, any]) => ({
            name,
            healthy: info.healthy,
            latency: info.latency,
            error: info.error,
          }))
        );
      }
    } catch (e) {
      toast.error("Failed to fetch health status");
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Health Check</CardTitle>
          <CardDescription>AI provider health status</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchHealth} disabled={checking}>
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} data-icon="inline-end" />
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-secondary/30 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latency</TableHead>
                <TableHead>Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map(p => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Badge variant={p.healthy ? "default" : "destructive"}>
                      {p.healthy ? "Healthy" : "Error"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {p.latency ? `${p.latency}ms` : "-"}
                  </TableCell>
                  <TableCell>
                    {p.error && (
                      <span className="text-sm text-destructive">{p.error}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create test-model.tsx component**

```tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { FieldGroup } from "@/components/ui/field";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useState } from "react";
import { toast } from "sonner";

export function TestModel() {
  const [provider, setProvider] = useState("workers-ai");
  const [model, setModel] = useState("");
  const [prompt, setPrompt] = useState("Say hello");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleTest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/agent/test-model", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, prompt }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.response);
        toast.success("Test successful");
      } else {
        toast.error(data.error || "Test failed");
      }
    } catch (e) {
      toast.error("Failed to test model");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle>Test Model</CardTitle>
        <CardDescription>Test a specific AI model</CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Provider</FieldLabel>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="workers-ai">Workers AI</SelectItem>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Model</FieldLabel>
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="e.g., @cf/meta/llama-3.1-8b-instruct"
            />
            <FieldDescription>Leave empty for default model</FieldDescription>
          </Field>

          <Field>
            <FieldLabel>Prompt</FieldLabel>
            <Input
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Test prompt"
            />
          </Field>

          <Button onClick={handleTest} disabled={loading} className="w-full">
            {loading ? (
              <>
                <Spinner className="h-4 w-4" data-icon="inline-start" />
                Testing...
              </>
            ) : (
              "Run Test"
            )}
          </Button>

          {result && (
            <Alert>
              <AlertTitle>Result</AlertTitle>
              <AlertDescription className="whitespace-pre-wrap">
                {result}
              </AlertDescription>
            </Alert>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: Create models/page.tsx**

```tsx
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
          <h1 className="text-2xl font-semibold text-foreground">AI Models</h1>
          <p className="text-sm text-muted-foreground">
            Provider configuration and testing
          </p>
        </div>
      </motion.div>

      <Tabs defaultValue="config" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="config">Provider Config</TabsTrigger>
          <TabsTrigger value="health">Health Check</TabsTrigger>
          <TabsTrigger value="test">Test Model</TabsTrigger>
        </TabsList>
        <TabsContent value="config" className="mt-4">
          <ModelConfig />
        </TabsContent>
        <TabsContent value="health" className="mt-4">
          <HealthCheck />
        </TabsContent>
        <TabsContent value="test" className="mt-4">
          <TestModel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 5: Run typecheck**

Run: `cd /home/jango/Git/hoox-setup/pages/dashboard && bunx tsc --noEmit`
Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
cd /home/jango/Git/hoox-setup
git add pages/dashboard/src/app/dashboard/agent/models/page.tsx
git add pages/dashboard/src/components/agent/model-config.tsx
git add pages/dashboard/src/components/agent/health-check.tsx
git add pages/dashboard/src/components/agent/test-model.tsx
git commit -m "feat(dashboard): add agent models page with tabs"
```
