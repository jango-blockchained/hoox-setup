"use client"

import { useState } from "react";
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
import { Zap, Shield, AlertTriangle, Brain, Bell, Save, KeyRound } from "lucide-react";

interface SettingSection {
  id: string
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  fields: SettingField[]
}

interface SettingField {
  key: string
  label: string
  description?: string
  type: "boolean" | "number" | "text" | "select" | "json"
  value: string | number | boolean
  options?: { value: string; label: string }[]
  placeholder?: string
}

const settingsSections: SettingSection[] = [
  {
    id: "auth",
    title: "Authentication",
    description: "Dashboard authentication settings",
    icon: KeyRound,
    fields: [
      {
        key: "auth:type",
        label: "Auth Type",
        description: "Choose authentication method",
        type: "select",
        value: "basic",
        options: [
          { value: "basic", label: "Basic Auth (Username/Password)" },
          { value: "cf-access", label: "Cloudflare Access" },
          { value: "none", label: "No Auth (Development Only)" },
        ],
      },
    ],
  },
  {
    id: "global",
    title: "Global Settings",
    description: "High-level system configuration",
    icon: Zap,
    fields: [
      {
        key: "global:kill_switch",
        label: "Global Kill Switch",
        description: "Pause all trading immediately",
        type: "boolean",
        value: false,
      },
      {
        key: "global:maintenance_mode",
        label: "Maintenance Mode",
        description: "Enable maintenance page",
        type: "boolean",
        value: false,
      },
    ],
  },
  {
    id: "security",
    title: "Security",
    description: "Webhook and API security settings",
    icon: Shield,
    fields: [
      {
        key: "webhook:tradingview:ip_check_enabled",
        label: "Enable TradingView IP Validation",
        description: "Validate incoming webhook IPs against TradingView allowlist",
        type: "boolean",
        value: true,
      },
      {
        key: "webhook:tradingview:allowed_ips",
        label: "Allowed IPs",
        description: "JSON array of allowed IP addresses",
        type: "json",
        value: '["52.89.214.238", "34.212.75.30", "54.218.53.128"]',
        placeholder: '["ip1", "ip2"]',
      },
      {
        key: "global:api_key_required",
        label: "Require API Key",
        description: "Require API key for all webhook requests",
        type: "boolean",
        value: true,
      },
    ],
  },
  {
    id: "risk",
    title: "Risk Management",
    description: "Position sizing and risk limits",
    icon: AlertTriangle,
    fields: [
      {
        key: "trade:default_leverage",
        label: "Default Leverage",
        description: "Default leverage for new positions",
        type: "number",
        value: 10,
        placeholder: "10",
      },
      {
        key: "trade:max_position_size",
        label: "Max Position Size (USD)",
        description: "Maximum position size in USD",
        type: "number",
        value: 1000,
        placeholder: "1000",
      },
      {
        key: "trade:max_daily_drawdown_percent",
        label: "Max Daily Drawdown (%)",
        description: "Maximum allowed daily drawdown percentage",
        type: "number",
        value: -5,
        placeholder: "-5",
      },
    ],
  },
  {
    id: "agent",
    title: "Agent Configuration",
    description: "AI agent and automation settings",
    icon: Brain,
    fields: [
      {
        key: "agent:default_provider",
        label: "Default AI Provider",
        description: "AI provider for summaries and risk analysis",
        type: "select",
        value: "workers-ai",
        options: [
          { value: "workers-ai", label: "Cloudflare Workers AI" },
          { value: "openai", label: "OpenAI" },
          { value: "anthropic", label: "Anthropic" },
          { value: "google", label: "Google AI" },
        ],
      },
      {
        key: "agent:timeout_ms",
        label: "AI Timeout (ms)",
        description: "Timeout for AI requests in milliseconds",
        type: "number",
        value: 30000,
        placeholder: "30000",
      },
      {
        key: "agent:retry_count",
        label: "AI Retry Count",
        description: "Number of retries for failed AI requests",
        type: "number",
        value: 3,
        placeholder: "3",
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Alert and notification settings",
    icon: Bell,
    fields: [
      {
        key: "notify:telegram_enabled",
        label: "Enable Telegram Alerts",
        description: "Send trade alerts via Telegram",
        type: "boolean",
        value: true,
      },
      {
        key: "notify:email_enabled",
        label: "Enable Email Alerts",
        description: "Send trade alerts via email",
        type: "boolean",
        value: false,
      },
      {
        key: "notify:on_error_only",
        label: "Notify on Errors Only",
        description: "Only send notifications for errors",
        type: "boolean",
        value: false,
      },
    ],
  },
]

const connectedWorkers = [
  { name: "hoox", displayName: "Gateway", enabled: true },
  { name: "trade-worker", displayName: "Trade Worker", enabled: true },
  { name: "d1-worker", displayName: "D1 Worker", enabled: true },
  { name: "agent-worker", displayName: "Agent Worker", enabled: true },
  { name: "telegram-worker", displayName: "Telegram Worker", enabled: true },
  { name: "email-worker", displayName: "Email Worker", enabled: false },
]

export function SettingsForm() {
  const [settings, setSettings] = useState<Record<string, string | number | boolean>>(() => {
    const initial: Record<string, string | number | boolean> = {}
    settingsSections.forEach((section) => {
      section.fields.forEach((field) => {
        initial[field.key] = field.value
      })
    })
    return initial
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleChange = (key: string, value: string | number | boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsSaving(false)
    toast.success("Settings saved successfully", {
      description: "Your configuration has been updated.",
    })
  }

  const renderField = (field: SettingField) => {
    const value = settings[field.key]

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
              onCheckedChange={(checked) => handleChange(field.key, checked)}
            />
          </div>
        )

      case "number":
        return (
          <Field>
            <FieldLabel>{field.label}</FieldLabel>
            <Input
              type="number"
              value={value as number}
              onChange={(e) => handleChange(field.key, parseFloat(e.target.value) || 0)}
              placeholder={field.placeholder}
              className="bg-secondary/50"
            />
            {field.description && (
              <FieldDescription>{field.description}</FieldDescription>
            )}
          </Field>
        )

      case "select":
        return (
          <Field>
            <FieldLabel>{field.label}</FieldLabel>
            <Select
              value={value as string}
              onValueChange={(newValue) => handleChange(field.key, newValue)}
            >
              <SelectTrigger className="bg-secondary/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.description && (
              <FieldDescription>{field.description}</FieldDescription>
            )}
          </Field>
        )

      case "json":
        return (
          <Field>
            <FieldLabel>{field.label}</FieldLabel>
            <Textarea
              value={value as string}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="min-h-[80px] bg-secondary/50 font-mono text-sm"
            />
            {field.description && (
              <FieldDescription>{field.description}</FieldDescription>
            )}
          </Field>
        )

      default:
        return (
          <Field>
            <FieldLabel>{field.label}</FieldLabel>
            <Input
              type="text"
              value={value as string}
              onChange={(e) => handleChange(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="bg-secondary/50"
            />
            {field.description && (
              <FieldDescription>{field.description}</FieldDescription>
            )}
          </Field>
        )
    }
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
            {connectedWorkers.map((worker) => (
              <Badge
                key={worker.name}
                variant={worker.enabled ? "default" : "secondary"}
                className={worker.enabled ? "bg-primary/20 text-primary" : ""}
              >
                <span
                  className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                    worker.enabled ? "bg-success" : "bg-muted-foreground"
                  }`}
                />
                {worker.displayName}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {settingsSections.map((section) => (
        <Card key={section.id} className="bg-card border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <section.icon className="h-4 w-4 text-primary" />
              {section.title}
            </CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              {section.fields.map((field) => (
                <div key={field.key}>{renderField(field)}</div>
              ))}
            </FieldGroup>
          </CardContent>
        </Card>
      ))}

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
  )
}
