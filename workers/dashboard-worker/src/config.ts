import { KVNamespace } from '@cloudflare/workers-types';

export interface ConfigField {
  key: string;
  label: string;
  description?: string;
  type: 'text' | 'number' | 'boolean' | 'json' | 'select' | 'textarea';
  value?: string | number | boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  category: string;
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: string;
  };
  sensitive?: boolean;
}

export interface ConfigSection {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  fields: ConfigField[];
}

export interface ConfigSchema {
  version: string;
  lastUpdated: string;
  sections: ConfigSection[];
}

export type ConfigLoader = (kv: KVNamespace) => Promise<Record<string, string>>;

export const DEFAULT_SCHEMA: ConfigSchema = {
  version: '1.0.0',
  lastUpdated: new Date().toISOString(),
  sections: [
    {
      id: 'global',
      title: 'Global Settings',
      description: 'High-level system configuration',
      icon: '⚡',
      fields: [
        {
          key: 'global:kill_switch',
          label: 'Global Kill Switch',
          description: 'Pause all trading immediately',
          type: 'boolean',
          category: 'global'
        },
        {
          key: 'global:maintenance_mode',
          label: 'Maintenance Mode',
          description: 'Enable maintenance page',
          type: 'boolean',
          category: 'global'
        }
      ]
    },
    {
      id: 'security',
      title: 'Security',
      description: 'Webhook and API security settings',
      icon: '🔒',
      fields: [
        {
          key: 'webhook:tradingview:ip_check_enabled',
          label: 'Enable TradingView IP Validation',
          type: 'boolean',
          category: 'security'
        },
        {
          key: 'webhook:tradingview:allowed_ips',
          label: 'Allowed IPs',
          description: 'JSON array of allowed IP addresses',
          type: 'json',
          category: 'security'
        },
        {
          key: 'global:api_key_required',
          label: 'Require API Key',
          type: 'boolean',
          category: 'security'
        }
      ]
    },
    {
      id: 'risk',
      title: 'Risk Management',
      description: 'Position sizing and risk limits',
      icon: '⚠️',
      fields: [
        {
          key: 'trade:default_leverage',
          label: 'Default Leverage',
          type: 'number',
          placeholder: '10',
          category: 'risk'
        },
        {
          key: 'trade:max_position_size',
          label: 'Max Position Size (USD)',
          type: 'number',
          placeholder: '1000',
          category: 'risk'
        },
        {
          key: 'trade:max_daily_drawdown_percent',
          label: 'Max Daily Drawdown (%)',
          type: 'number',
          value: -5,
          category: 'risk'
        }
      ]
    },
    {
      id: 'agent',
      title: 'Agent Configuration',
      description: 'AI agent and automation settings',
      icon: '🤖',
      fields: [
        {
          key: 'agent:default_provider',
          label: 'Default AI Provider',
          type: 'select',
          options: [
            { value: 'workers-ai', label: 'Cloudflare Workers AI' },
            { value: 'openai', label: 'OpenAI' },
            { value: 'anthropic', label: 'Anthropic' },
            { value: 'google', label: 'Google AI' }
          ],
          category: 'agent'
        },
        {
          key: 'agent:timeout_ms',
          label: 'AI Timeout (ms)',
          type: 'number',
          value: 30000,
          category: 'agent'
        },
        {
          key: 'agent:retry_count',
          label: 'AI Retry Count',
          type: 'number',
          value: 3,
          category: 'agent'
        }
      ]
    },
    {
      id: 'notifications',
      title: 'Notifications',
      description: 'Alert and notification settings',
      icon: '🔔',
      fields: [
        {
          key: 'notify:telegram_enabled',
          label: 'Enable Telegram Alerts',
          type: 'boolean',
          category: 'notifications'
        },
        {
          key: 'notify:email_enabled',
          label: 'Enable Email Alerts',
          type: 'boolean',
          category: 'notifications'
        },
        {
          key: 'notify:on_error_only',
          label: 'Notify on Errors Only',
          type: 'boolean',
          category: 'notifications'
        }
      ]
    }
  ]
};

export async function loadConfigFromKV(
  kv: KVNamespace,
  schema: ConfigSchema
): Promise<Record<string, string | number | boolean>> {
  const config: Record<string, string | number | boolean> = {};
  
  for (const section of schema.sections) {
    for (const field of section.fields) {
      const value = await kv.get(field.key);
      if (value !== null) {
        try {
          config[field.key] = JSON.parse(value);
        } catch {
          config[field.key] = value;
        }
      } else if (field.value !== undefined) {
        config[field.key] = field.value;
      }
    }
  }
  
  return config;
}

export async function saveConfigToKV(
  kv: KVNamespace,
  updates: Record<string, any>
): Promise<void> {
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined || value === null) {
      continue;
    }
    
    const stringValue = typeof value === 'object' 
      ? JSON.stringify(value) 
      : String(value);
    
    await kv.put(key, stringValue);
  }
}

export function getFieldsByCategory(
  schema: ConfigSchema,
  category: string
): ConfigField[] {
  const fields: ConfigField[] = [];
  
  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (field.category === category) {
        fields.push(field);
      }
    }
  }
  
  return fields;
}

export function getSectionFields(
  schema: ConfigSchema,
  sectionId: string
): ConfigField[] {
  const section = schema.sections.find(s => s.id === sectionId);
  return section?.fields || [];
}