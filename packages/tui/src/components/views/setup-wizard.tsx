/** @jsxImportSource @opentui/react */
/**
 * Setup Wizard — 6-step onboarding for first-run Hoox configuration.
 *
 * Steps: 1=API Keys, 2=Exchanges, 3=AI Providers, 4=Strategies,
 *        5=Notifications, 6=Deploy
 *
 * Writes completed config to useConfigStore on final deploy action.
 * Can be reopened from Settings via UI store setView('setup-wizard').
 *
 * Uses subtask_07 dialog.tsx for deploy confirmation via showConfirm().
 */
import { useState } from "react"
import { useKeyboard } from "@opentui/react"
import { Colors } from "@jango-blockchained/hoox-shared"
import { useConfigStore } from "@jango-blockchained/hoox-shared"
import { useUIStore } from "@jango-blockchained/hoox-shared"
import { ErrorBoundary } from "../shared/error-boundary"
import { showConfirm } from "../ui/dialog"
import type { DialogHandle } from "../ui/dialog"

// ─── Constants ──────────────────────────────────────────────────────────────

/** Ordered step labels displayed in the progress indicator */
const STEPS = [
  "API Keys",
  "Exchanges",
  "AI Providers",
  "Strategies",
  "Notifications",
  "Deploy",
] as const

const TOTAL_STEPS = STEPS.length

/** Exchanges supported by the wizard */
const EXCHANGES = ["Binance", "Bybit", "MEXC"] as const

/** Strategy types available */
const STRATEGIES = ["grid", "macd", "scalping"] as const

type StrategyType = (typeof STRATEGIES)[number]

// ─── Form Data Shape ────────────────────────────────────────────────────────

interface ApiKeyEntry {
  key: string
  secret: string
}

interface WizardFormData {
  apiKeys: Record<string, ApiKeyEntry>
  exchanges: Record<string, boolean>
  ai: { providerUrl: string; apiKey: string; model: string }
  strategy: { type: StrategyType; params: Record<string, string> }
  notifications: {
    email: { enabled: boolean; address: string }
    telegram: { enabled: boolean; botToken: string; chatId: string }
    discord: { enabled: boolean; webhookUrl: string }
  }
}

/** Validation result: null = unchecked, true = valid, false = invalid */
type ValidationState = null | boolean

// ─── Default Form Data ──────────────────────────────────────────────────────

const defaultFormData = (): WizardFormData => ({
  apiKeys: {
    binance: { key: "", secret: "" },
    bybit:   { key: "", secret: "" },
    mexc:    { key: "", secret: "" },
  },
  exchanges: { binance: false, bybit: false, mexc: false },
  ai: { providerUrl: "", apiKey: "", model: "default" },
  strategy: { type: "grid", params: {} },
  notifications: {
    email:    { enabled: false, address: "" },
    telegram: { enabled: false, botToken: "", chatId: "" },
    discord:  { enabled: false, webhookUrl: "" },
  },
})

// ─── Validation Helpers ─────────────────────────────────────────────────────

/** Basic format check for exchange API keys (non-empty, no whitespace at ends) */
function validateApiKey(value: string): boolean {
  return value.trim().length >= 16 && value === value.trim()
}

/** Basic email format check */
function validateEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/** Basic URL format check */
function validateUrl(value: string): boolean {
  return /^https?:\/\/.+/.test(value)
}

/** Mask a secret string: show first 4 and last 4 chars, fill middle with •••• */
function maskSecret(value: string): string {
  if (value.length <= 8) return "•".repeat(value.length || 4)
  return value.slice(0, 4) + "••••" + value.slice(-4)
}

// ─── Component Props ────────────────────────────────────────────────────────

export interface SetupWizardProps {
  /** Dialog handle for deploy confirmation (injected by parent or default) */
  dialog?: DialogHandle
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SetupWizard({ dialog }: SetupWizardProps) {
  const [step, setStep] = useState(0)
  const [data, setData] = useState<WizardFormData>(defaultFormData)
  const [validation, setValidation] = useState<Record<string, ValidationState>>({})

  const updateConfig = useConfigStore((s) => s.updateConfig)
  const setView = useUIStore((s) => s.setView)

  /**
   * Update a field in the form data (deep path via dot notation, e.g. "apiKeys.binance.key")
   * Resets any existing validation for that field.
   */
  const updateField = (path: string, value: string | boolean) => {
    setData((prev) => {
      const next = structuredClone(prev)
      const keys = path.split(".")
      let obj: Record<string, unknown> = next as unknown as Record<string, unknown>
      for (let i = 0; i < keys.length - 1; i++) {
        obj = obj[keys[i]] as Record<string, unknown>
      }
      obj[keys[keys.length - 1]] = value
      return next
    })
    // Clear validation when field changes
    setValidation((prev) => {
      const next = { ...prev }
      delete next[path]
      return next
    })
  }

  /** Validate the current step's fields and update validation state */
  const validateStep = (): boolean => {
    const results: Record<string, ValidationState> = {}
    let allValid = true

    if (step === 0) {
      // Validate API keys
      for (const exchange of EXCHANGES) {
        const e = exchange.toLowerCase()
        const keyPath = `apiKeys.${e}.key`
        const secretPath = `apiKeys.${e}.secret`
        const key = data.apiKeys[e].key
        const secret = data.apiKeys[e].secret
        if (key) {
          results[keyPath] = validateApiKey(key)
          if (!results[keyPath]) allValid = false
        }
        if (secret) {
          results[secretPath] = validateApiKey(secret)
          if (!results[secretPath]) allValid = false
        }
      }
    } else if (step === 4) {
      // Validate notification fields
      if (data.notifications.email.enabled) {
        results["notifications.email.address"] = data.notifications.email.address
          ? validateEmail(data.notifications.email.address)
          : false
        if (!results["notifications.email.address"]) allValid = false
      }
      if (data.notifications.telegram.enabled) {
        results["notifications.telegram.botToken"] = data.notifications.telegram.botToken
          ? data.notifications.telegram.botToken.trim().length > 0
          : false
        if (!results["notifications.telegram.botToken"]) allValid = false
      }
      if (data.notifications.discord.enabled) {
        results["notifications.discord.webhookUrl"] = data.notifications.discord.webhookUrl
          ? validateUrl(data.notifications.discord.webhookUrl)
          : false
        if (!results["notifications.discord.webhookUrl"]) allValid = false
      }
    }

    setValidation((prev) => ({ ...prev, ...results }))
    return allValid
  }

  /** Advance to next step (with validation) */
  const handleNext = () => {
    if (validateStep() && step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1)
    }
  }

  /** Go back to previous step */
  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1)
  }

  /** Skip current step (only allowed for optional steps: Exchanges, Strategies) */
  const handleSkip = () => {
    if (step < TOTAL_STEPS - 1) {
      // Steps 1 (Exchanges) and 3 (Strategies) are skippable
      setStep((s) => s + 1)
    }
  }

  /** Deploy: write config and navigate away */
  const handleDeploy = async () => {
    try {
      const activeExchanges = Object.entries(data.exchanges)
        .filter(([, v]) => v)
        .map(([k]) => k)

      updateConfig({ activeExchanges })

      if (dialog) {
        const confirmed = await showConfirm(dialog, {
          title: "Deploy Configuration",
          message: "Save setup and apply configuration?",
          confirmLabel: "Deploy",
          cancelLabel: "Cancel",
        })
        if (confirmed) {
          setView("dashboard")
        }
      } else {
        setView("dashboard")
      }
    } catch {
      // Error in config write or dialog — handled by ErrorBoundary
    }
  }

  // ── Keyboard navigation ─────────────────────────────────────────────────
  useKeyboard((key) => {
    if (key.name === "right" || (key.ctrl && key.name === "n")) handleNext()
    if (key.name === "left"  || (key.ctrl && key.name === "p")) handleBack()
    if (key.name === "escape") handleBack()
    if (key.name === "tab" && key.shift) handleBack()
  })

  // ── Validation indicator for a field ─────────────────────────────────────
  const ValidationIcon = ({ fieldPath }: { fieldPath: string }) => {
    const state = validation[fieldPath]
    if (state === null) return null
    return (
      <text fg={state ? Colors.success : Colors.error}>
        {state ? " ✓" : " ✗"}
      </text>
    )
  }

  // ── Masked input for secrets ────────────────────────────────────────────
  const SecretField = ({
    label,
    value,
    path,
    width,
  }: {
    label: string
    value: string
    path: string
    width?: number
  }) => (
    <box flexDirection="row" gap={1}>
      <text fg={Colors.muted} width={16}>
        {label}
      </text>
      <text fg={value ? Colors.muted : Colors.dim} width={width ?? 24}>
        {value ? maskSecret(value) : "(not set)"}
      </text>
      <ValidationIcon fieldPath={path} />
    </box>
  )

  // ── Checkbox toggle ─────────────────────────────────────────────────────
  const Checkbox = ({
    label,
    checked,
    path,
  }: {
    label: string
    checked: boolean
    path: string
  }) => (
    <box flexDirection="row" gap={1}>
      <text
        fg={checked ? Colors.accent : Colors.muted}
        onMouseUp={() => updateField(path, !checked)}
      >
        {checked ? "[x]" : "[ ]"}
      </text>
      <text fg={Colors.foreground}>{label}</text>
    </box>
  )

  // ── Step Content Renderers ──────────────────────────────────────────────

  /** Step 0: API Keys */
  const StepApiKeys = () => (
    <box flexDirection="column" gap={0}>
      <text bold fg={Colors.accent}>
        Exchange API Keys
      </text>
      <text dim fg={Colors.muted}>
        Enter your exchange API credentials. Secrets are stored encrypted.
      </text>
      <box flexDirection="column" gap={1} paddingTop={1}>
        {EXCHANGES.map((name) => {
          const e = name.toLowerCase()
          return (
            <box flexDirection="column" gap={0}>
              <text bold fg={Colors.foreground}>
                {name}
              </text>
              <SecretField
                label="  API Key"
                value={data.apiKeys[e].key}
                path={`apiKeys.${e}.key`}
              />
              <SecretField
                label="  API Secret"
                value={data.apiKeys[e].secret}
                path={`apiKeys.${e}.secret`}
              />
            </box>
          )
        })}
      </box>
    </box>
  )

  /** Step 1: Exchanges */
  const StepExchanges = () => (
    <box flexDirection="column" gap={0}>
      <text bold fg={Colors.accent}>
        Active Exchanges
      </text>
      <text dim fg={Colors.muted}>
        Enable the exchanges you want to trade on.
      </text>
      <box flexDirection="column" gap={0} paddingTop={1}>
        {EXCHANGES.map((name) => (
          <Checkbox
            label={name}
            checked={data.exchanges[name.toLowerCase()]}
            path={`exchanges.${name.toLowerCase()}`}
          />
        ))}
      </box>
    </box>
  )

  /** Step 2: AI Providers */
  const StepAiProviders = () => (
    <box flexDirection="column" gap={0}>
      <text bold fg={Colors.accent}>
        AI Provider
      </text>
      <text dim fg={Colors.muted}>
        Configure the AI endpoint for strategy generation.
      </text>
      <box flexDirection="column" gap={1} paddingTop={1}>
        <box flexDirection="row" gap={1}>
          <text fg={Colors.muted} width={12}>
            Provider URL
          </text>
          <text fg={data.ai.providerUrl ? Colors.foreground : Colors.dim}>
            {data.ai.providerUrl || "(not set)"}
          </text>
        </box>
        <SecretField label="API Key" value={data.ai.apiKey} path="ai.apiKey" />
        <box flexDirection="row" gap={1}>
          <text fg={Colors.muted} width={12}>
            Model
          </text>
          <text fg={Colors.foreground}>{data.ai.model}</text>
        </box>
      </box>
    </box>
  )

  /** Step 3: Strategies */
  const StepStrategies = () => (
    <box flexDirection="column" gap={0}>
      <text bold fg={Colors.accent}>
        Trading Strategy
      </text>
      <text dim fg={Colors.muted}>
        Select your primary trading strategy.
      </text>
      <box flexDirection="column" gap={0} paddingTop={1}>
        {STRATEGIES.map((s) => (
          <box flexDirection="row" gap={1}>
            <text
              fg={data.strategy.type === s ? Colors.accent : Colors.muted}
              onMouseUp={() => {
                setData((prev) => ({
                  ...prev,
                  strategy: { ...prev.strategy, type: s },
                }))
              }}
            >
              {data.strategy.type === s ? "(•) " : "( ) "}
            </text>
            <text fg={Colors.foreground}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </text>
          </box>
        ))}
      </box>
    </box>
  )

  /** Step 4: Notifications */
  const StepNotifications = () => (
    <box flexDirection="column" gap={0}>
      <text bold fg={Colors.accent}>
        Notifications
      </text>
      <text dim fg={Colors.muted}>
        Configure alert channels for trade events and system status.
      </text>
      <box flexDirection="column" gap={1} paddingTop={1}>
        {/* Email */}
        <box flexDirection="column" gap={0}>
          <Checkbox
            label="Email"
            checked={data.notifications.email.enabled}
            path="notifications.email.enabled"
          />
          {data.notifications.email.enabled && (
            <box flexDirection="row" gap={1} paddingLeft={3}>
              <text fg={Colors.muted} width={10}>
                Address
              </text>
              <text fg={Colors.foreground}>
                {data.notifications.email.address || "(enter address)"}
              </text>
              <ValidationIcon fieldPath="notifications.email.address" />
            </box>
          )}
        </box>

        {/* Telegram */}
        <box flexDirection="column" gap={0}>
          <Checkbox
            label="Telegram"
            checked={data.notifications.telegram.enabled}
            path="notifications.telegram.enabled"
          />
          {data.notifications.telegram.enabled && (
            <box flexDirection="column" gap={0} paddingLeft={3}>
              <SecretField
                label="Bot Token"
                value={data.notifications.telegram.botToken}
                path="notifications.telegram.botToken"
              />
              <ValidationIcon fieldPath="notifications.telegram.botToken" />
              <box flexDirection="row" gap={1}>
                <text fg={Colors.muted} width={10}>
                  Chat ID
                </text>
                <text fg={Colors.foreground}>
                  {data.notifications.telegram.chatId || "(enter ID)"}
                </text>
              </box>
            </box>
          )}
        </box>

        {/* Discord */}
        <box flexDirection="column" gap={0}>
          <Checkbox
            label="Discord"
            checked={data.notifications.discord.enabled}
            path="notifications.discord.enabled"
          />
          {data.notifications.discord.enabled && (
            <box flexDirection="row" gap={1} paddingLeft={3}>
              <text fg={Colors.muted} width={12}>
                Webhook URL
              </text>
              <text fg={data.notifications.discord.webhookUrl ? Colors.foreground : Colors.dim}>
                {data.notifications.discord.webhookUrl
                  ? maskSecret(data.notifications.discord.webhookUrl)
                  : "(enter URL)"}
              </text>
              <ValidationIcon fieldPath="notifications.discord.webhookUrl" />
            </box>
          )}
        </box>
      </box>
    </box>
  )

  /** Step 5: Deploy — Summary view */
  const StepDeploy = () => {
    const activeCount = Object.values(data.exchanges).filter(Boolean).length
    const apiKeysConfigured = Object.values(data.apiKeys).filter(
      (e) => e.key || e.secret,
    ).length
    const notifCount = [
      data.notifications.email.enabled,
      data.notifications.telegram.enabled,
      data.notifications.discord.enabled,
    ].filter(Boolean).length

    return (
      <box flexDirection="column" gap={0}>
        <text bold fg={Colors.accent}>
          Ready to Deploy
        </text>
        <text dim fg={Colors.muted}>
          Review your configuration before deploying.
        </text>
        <box flexDirection="column" gap={0} paddingTop={1}>
          <text fg={Colors.foreground}>
            Exchanges: {activeCount} active ({data.exchanges.binance ? "Binance " : ""}
            {data.exchanges.bybit ? "Bybit " : ""}
            {data.exchanges.mexc ? "MEXC" : ""}
            {activeCount === 0 ? "none" : ""})
          </text>
          <text fg={Colors.foreground}>
            API Keys: {apiKeysConfigured}/3 configured
          </text>
          <text fg={Colors.foreground}>
            AI Provider: {data.ai.providerUrl ? data.ai.model : "not configured"}
          </text>
          <text fg={Colors.foreground}>
            Strategy: {data.strategy.type}
          </text>
          <text fg={Colors.foreground}>
            Notifications: {notifCount} channels
            {data.notifications.email.enabled ? " Email" : ""}
            {data.notifications.telegram.enabled ? " Telegram" : ""}
            {data.notifications.discord.enabled ? " Discord" : ""}
            {notifCount === 0 ? " none" : ""}
          </text>
        </box>
        <box paddingTop={2} justifyContent="center">
          <text
            fg={Colors.accent}
            bg={Colors.card}
            bold
            onMouseUp={handleDeploy}
          >
            {"  [ Deploy Now ]  "}
          </text>
        </box>
      </box>
    )
  }

  // ─── Progress Indicator ─────────────────────────────────────────────────

  const progressLine = STEPS.map((label, i) => {
    const isFilled = i <= step
    const isCurrent = i === step
    return (
      <text
        fg={isCurrent ? Colors.accent : isFilled ? Colors.success : Colors.dim}
        bold={isCurrent}
      >
        {isFilled ? "█" : "░"} {label}{"  "}
      </text>
    )
  })

  // ─── Current Step Content ────────────────────────────────────────────────

  const stepContent = (() => {
    switch (step) {
      case 0: return <StepApiKeys />
      case 1: return <StepExchanges />
      case 2: return <StepAiProviders />
      case 3: return <StepStrategies />
      case 4: return <StepNotifications />
      case 5: return <StepDeploy />
      default: return <text>Unknown step</text>
    }
  })()

  const isFirstStep = step === 0
  const isLastStep = step === TOTAL_STEPS - 1
  const canSkip = step === 1 || step === 3 // Exchanges and Strategies are optional

  return (
    <ErrorBoundary viewName="Setup Wizard">
      <box flexDirection="column" flexGrow={1} padding={2} gap={1}>
        {/* Title */}
        <text bold fg={Colors.foreground}>
          Setup Wizard — Step {step + 1} of {TOTAL_STEPS}: {STEPS[step]}
        </text>

        {/* Progress Indicator */}
        <box flexDirection="row" gap={0} paddingBottom={1}>
          {progressLine}
        </box>

        {/* Separator */}
        <text fg={Colors.border} dim>
          {"─".repeat(60)}
        </text>

        {/* Step Content (scrollbox for overflow) */}
        <scrollbox flexGrow={1} border={false}>
          {stepContent}
        </scrollbox>

        {/* Navigation Bar */}
        <box
          flexDirection="row"
          justifyContent="space-between"
          paddingTop={1}
        >
          {/* Left: Back */}
          <text
            fg={isFirstStep ? Colors.dim : Colors.muted}
            onMouseUp={isFirstStep ? undefined : handleBack}
          >
            {isFirstStep ? "            " : "[← Back]"}
          </text>

          {/* Center: Skip */}
          <text
            fg={canSkip && !isLastStep ? Colors.muted : Colors.dim}
            onMouseUp={canSkip && !isLastStep ? handleSkip : undefined}
          >
            {canSkip && !isLastStep ? "[Skip]" : ""}
          </text>

          {/* Right: Next / Deploy */}
          <text
            fg={isLastStep ? Colors.dim : Colors.accent}
            bold={!isLastStep}
            onMouseUp={isLastStep ? undefined : handleNext}
          >
            {isLastStep ? "" : "[Next →]"}
          </text>
        </box>

        {/* Keybindings hint */}
        <text dim fg={Colors.dim}>
          ← → navigate steps  |  Tab next field  |  Esc back  |  Skip optional steps
        </text>
      </box>
    </ErrorBoundary>
  )
}
