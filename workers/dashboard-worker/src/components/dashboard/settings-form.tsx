"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { Zap, Shield, AlertTriangle, Brain, Bell, Save, KeyRound, Database, Mail, Layers, Clock, Activity, Search, Archive, Router, Send, Sparkles } from "lucide-react";
import type { WorkerConfigManifest } from "@/lib/settings/types";
import { loadAllConfigs, loadMergedSettings } from "@/lib/settings/loader";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  router: Router,
  zap: Zap,
  shield: Shield,
  brain: Brain,
  bell: Bell,
  database: Database,
  mail: Mail,
  layers: Layers,
  clock: Clock,
  activity: Activity,
  search: Search,
  archive: Archive,
  send: Send,
  sparkles: Sparkles,
};

interface SettingField {
  key: string;
  label: string;
  description?: string;
  type: "boolean" | "number" | "text" | "select" | "json" | "textarea";
  default: string | number | boolean;
  options?: { value: string; label: string }[];
  placeholder?: string;
}

interface SettingSection {
  id: string;
  title: string;
  description: string;
  icon?: string;
  priority: number;
  fields: SettingField[];
}

interface ConnectedWorker {
  name: string;
  displayName: string;
  enabled: boolean;
}

const DEFAULT_WORKERS: ConnectedWorker[] = [
  { name: "hoox", displayName: "Gateway", enabled: true },
  { name: "trade-worker", displayName: "Trade Worker", enabled: true },
  { name: "d1-worker", displayName: "D1 Worker", enabled: true },
  { name: "agent-worker", displayName: "Agent Worker", enabled: true },
  { name: "telegram-worker", displayName: "Telegram Worker", enabled: true },
  { name: "email-worker", displayName: "Email Worker", enabled: false },
];

export function SettingsForm() {
  const [configs, setConfigs] = useState<WorkerConfigManifest[]>([]);
  const [settings, setSettings] = useState<Record<string, Record<string, string | number | boolean>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const workerNames = DEFAULT_WORKERS.filter((w) => w.enabled).map((w) => w.name);
        const loadedConfigs = await loadAllConfigs(workerNames);
        const loadedSettings = await loadMergedSettings(workerNames);

        setConfigs(loadedConfigs);
        setSettings(loadedSettings);
      } catch (err) {
        console.error("Failed to load settings:", err);
        toast.error("Failed to load settings");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, []);

  const handleChange = (worker: string, key: string, value: string | number | boolean) => {
    setSettings((prev) => ({
      ...prev,
      [worker]: {
        ...prev[worker],
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);

    try {
      for (const [worker, fields] of Object.entries(settings)) {
        for (const [key, value] of Object.entries(fields)) {
          await fetch(`/api/settings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ worker, key, value }),
          });
        }
      }

      toast.success("Settings saved successfully", {
        description: "Your configuration has been updated.",
      });
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (worker: string, field: SettingField) => {
    const value = settings[worker]?.[field.key] ?? field.default;

    switch (field.type) {
      case "boolean":
        return (
          <div className="flex items-center justify-between rounded-md bg-secondary/30 p-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{field.label}</span>
              {field.description && (
                <span className="text-xs text-muted-foreground">{field.description}</span>
              )}
            </div>
            <Switch
              checked={value as boolean}
              onCheckedChange={(checked) => handleChange(worker, field.key, checked)}
            />
          </div>
        );

      case "number":
        return (
          <Field>
            <FieldLabel>{field.label}</FieldLabel>
            <Input
              type="number"
              value={value as number}
              onChange={(e) => handleChange(worker, field.key, parseFloat(e.target.value) || 0)}
              placeholder={String(field.placeholder)}
              className="bg-secondary/50"
            />
            {field.description && <FieldDescription>{field.description}</FieldDescription>}
          </Field>
        );

      case "select":
        return (
          <Field>
            <FieldLabel>{field.label}</FieldLabel>
            <Select
              value={String(value)}
              onValueChange={(newValue) => handleChange(worker, field.key, newValue)}
            >
              <SelectTrigger className="bg-secondary/50">
                <SelectValue placeholder={field.placeholder} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.description && <FieldDescription>{field.description}</FieldDescription>}
          </Field>
        );

      case "json":
      case "textarea":
        return (
          <Field>
            <FieldLabel>{field.label}</FieldLabel>
            <Textarea
              value={String(value)}
              onChange={(e) => handleChange(worker, field.key, e.target.value)}
              placeholder={String(field.placeholder)}
              className="min-h-[80px] bg-secondary/50 font-mono text-sm"
            />
            {field.description && <FieldDescription>{field.description}</FieldDescription>}
          </Field>
        );

      default:
        return (
          <Field>
            <FieldLabel>{field.label}</FieldLabel>
            <Input
              type="text"
              value={String(value)}
              onChange={(e) => handleChange(worker, field.key, e.target.value)}
              placeholder={String(field.placeholder)}
              className="bg-secondary/50"
            />
            {field.description && <FieldDescription>{field.description}</FieldDescription>}
          </Field>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Connected Workers</CardTitle>
          <CardDescription>Services connected to the dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_WORKERS.map((worker) => (
              <Badge
                key={worker.name}
                variant={worker.enabled ? "default" : "secondary"}
                className={worker.enabled ? "bg-primary/20 text-primary" : ""}
              >
                <span
                  className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                    worker.enabled ? "bg-emerald-500" : "bg-muted-foreground"
                  }`}
                />
                {worker.displayName}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {configs.flatMap((config) =>
        config.sections.map((section) => {
          const Icon = section.icon ? ICON_MAP[section.icon] : Zap;
          return (
            <Card key={`${config.worker}-${section.id}`} className="bg-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Icon className="h-4 w-4 text-primary" />
                  {config.displayName}: {section.title}
                </CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  {section.fields.map((field) => (
                    <div key={field.key}>{renderField(config.worker, field)}</div>
                  ))}
                </FieldGroup>
              </CardContent>
            </Card>
          );
        })
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? (
            <>
              <Spinner className="h-4 w-4" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Save Configuration
            </>
          )}
        </Button>
      </div>
    </div>
  );
}