import { DEFAULT_SCHEMA, type ConfigSchema, type ConfigField } from './config';
import { Fetcher, KVNamespace } from '@cloudflare/workers-types';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export interface WorkerBinding {
  name: string;
  service: string;
  enabled: boolean;
}

export interface WorkerConfig {
  name: string;
  displayName: string;
  description: string;
  settings: string[];
  enabled: boolean;
}

const DEFAULT_WORKERS: WorkerConfig[] = [
  {
    name: 'hoox',
    displayName: 'hoox',
    description: 'TradingView webhook gateway',
    settings: ['global:kill_switch', 'webhook:tradingview:ip_check_enabled', 'webhook:tradingview:allowed_ips', 'global:maintenance_mode', 'global:api_key_required'],
    enabled: true
  },
  {
    name: 'trade-worker',
    displayName: 'Trade Worker',
    description: 'Exchange trade execution',
    settings: ['trade:default_leverage', 'trade:max_position_size', 'trade:max_daily_drawdown_percent'],
    enabled: true
  },
  {
    name: 'agent-worker',
    displayName: 'Agent Worker',
    description: 'AI agent and risk management',
    settings: ['agent:default_provider', 'agent:timeout_ms', 'agent:retry_count'],
    enabled: true
  },
  {
    name: 'telegram-worker',
    displayName: 'Telegram Worker',
    description: 'Telegram notifications',
    settings: ['notify:telegram_enabled', 'notify:email_enabled', 'notify:on_error_only'],
    enabled: true
  },
  {
    name: 'd1-worker',
    displayName: 'D1 Worker',
    description: 'Database service',
    settings: [],
    enabled: true
  },
  {
    name: 'email-worker',
    displayName: 'Email Worker',
    description: 'Email scanning and processing',
    settings: ['notify:email_enabled'],
    enabled: true
  }
];

export interface ExtendedConfigField extends ConfigField {
  worker?: string;
  defaultValue?: string;
}

export interface SettingsPageConfig {
  schema: ConfigSchema;
  workers: WorkerConfig[];
  loadedValues: Record<string, any>;
}

export async function loadSettingsPageConfig(
  kv: KVNamespace | undefined,
  services: Record<string, Fetcher | undefined>,
  schema: ConfigSchema = DEFAULT_SCHEMA,
  workerConfigs: WorkerConfig[] = DEFAULT_WORKERS
): Promise<SettingsPageConfig> {
  const loadedValues: Record<string, any> = {};
  const enabledWorkerSettings = new Set<string>();
  const sectionsById = new Map<string, typeof schema.sections[0]>();
  
  for (const section of schema.sections) {
    sectionsById.set(section.id, section);
  }
  
  const detectedWorkers = workerConfigs.map(w => {
    const serviceBinding = w.name.toUpperCase().replace(/-/g, '_') + '_SERVICE';
    const workerBinding = w.name.toUpperCase().replace(/-/g, '_') + '_WORKER';
    const isEnabled = services[serviceBinding] !== undefined || 
                     services[workerBinding] !== undefined || 
                     w.enabled;
    
    if (isEnabled) {
      for (const settingKey of w.settings) {
        enabledWorkerSettings.add(settingKey);
      }
    }
    
    return { ...w, enabled: isEnabled };
  });
  
  if (kv) {
    const allKeys = [...enabledWorkerSettings];
    for (const key of allKeys) {
      const value = await kv.get(key);
      if (value !== null) {
        try {
          loadedValues[key] = JSON.parse(value);
        } catch {
          loadedValues[key] = value;
        }
      }
    }
    
    const cachedKeys = await kv.list();
    for (const kvKey of cachedKeys.keys) {
      const key = kvKey.name;
      if (!allKeys.includes(key)) {
        const value = await kv.get(key);
        if (value !== null) {
          try {
            loadedValues[key] = JSON.parse(value);
          } catch {
            loadedValues[key] = value;
          }
        }
      }
    }
  }
  
  const enrichedSections = schema.sections.map(section => ({
    ...section,
    fields: section.fields.map(field => ({
      ...field,
      defaultValue: loadedValues[field.key] !== undefined 
        ? String(loadedValues[field.key]) 
        : (field.value !== undefined ? String(field.value) : '')
    }))
  }));
  
  return {
    schema: {
      ...schema,
      sections: enrichedSections,
      lastUpdated: new Date().toISOString()
    },
    workers: detectedWorkers,
    loadedValues
  };
}

export function renderFieldInput(
  field: ConfigField,
  value: any
): string {
  const fieldName = field.key;
  const fieldId = `field-${field.key.replace(/:/g, '_')}`;
  const currentValue = value !== undefined ? escapeHtml(String(value)) : (field.value !== undefined ? escapeHtml(String(field.value)) : '');

  switch (field.type) {
    case 'boolean':
      return `
        <input type="hidden" name="${fieldName}" value="false" />
        <label class="flex items-center space-x-3">
          <input type="checkbox"
                 name="${fieldName}"
                 value="true"
                 ${currentValue === 'true' ? 'checked' : ''}
                 class="form-checkbox h-5 w-5 text-orange-500 rounded bg-neutral-900 border-neutral-700" />
          <span class="text-neutral-200">${escapeHtml(field.description || 'Enable')}</span>
        </label>
      `;

    case 'number':
      return `
        <input type="number"
               name="${fieldName}"
               value="${currentValue}"
               placeholder="${escapeHtml(field.placeholder || '')}"
               step="any"
               class="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-sm text-neutral-300 focus:border-orange-500 outline-none" />
      `;

    case 'select':
      const options = field.options?.map(opt =>
        `<option value="${escapeHtml(String(opt.value))}" ${String(opt.value) === (value !== undefined ? String(value) : field.value) ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`
      ).join('') || '';
      return `
        <select name="${fieldName}"
                class="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-sm text-neutral-300 focus:border-orange-500 outline-none">
          ${options}
        </select>
      `;

    case 'json':
      return `
        <textarea name="${fieldName}"
                  rows="3"
                  class="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-sm font-mono text-neutral-300 focus:border-orange-500 outline-none">${currentValue}</textarea>
        <p class="text-xs text-neutral-500 mt-1">${escapeHtml(field.description || 'Valid JSON required')}</p>
      `;

    case 'textarea':
      return `
        <textarea name="${fieldName}"
                  rows="3"
                  class="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-sm text-neutral-300 focus:border-orange-500 outline-none">${currentValue}</textarea>
        ${field.description ? `<p class="text-xs text-neutral-500 mt-1">${escapeHtml(field.description)}</p>` : ''}
      `;
    
    default:
      return `
        <input type="text"
               name="${fieldName}"
               value="${currentValue}"
               placeholder="${escapeHtml(field.placeholder || '')}"
               class="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-sm text-neutral-300 focus:border-orange-500 outline-none" />
        ${field.description ? `<p class="text-xs text-neutral-500 mt-1">${escapeHtml(field.description)}</p>` : ''}
      `;
  }
}

export function validateJsonField(value: string): { valid: boolean; parsed?: any; error?: string } {
  if (!value || value.trim() === '') {
    return { valid: true, parsed: null };
  }
  
  try {
    const parsed = JSON.parse(value);
    return { valid: true, parsed };
  } catch (e) {
    return { valid: false, error: (e as Error).message };
  }
}

export function parseSettingsFormData(formData: FormData): Record<string, any> {
  const updates: Record<string, any> = {};
  const collected: Record<string, string[]> = {};
  
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('_')) continue;
    if (typeof value !== 'string') continue;
    
    if (!collected[key]) {
      collected[key] = [];
    }
    collected[key].push(value);
  }
  
  for (const [key, values] of Object.entries(collected)) {
    if (values.includes('true')) {
      updates[key] = true;
    } else if (values.includes('false')) {
      updates[key] = false;
    } else if (values.length === 1 && values[0] === 'on') {
      updates[key] = true;
    } else if (values.length === 1) {
      const v = values[0];
      try {
        updates[key] = JSON.parse(v);
      } catch {
        updates[key] = v;
      }
    }
  }
  
  return updates;
}

export function getWorkerSettings(
  workerName: string,
  workers: WorkerConfig[]
): ConfigField[] {
  const worker = workers.find(w => w.name === workerName);
  if (!worker) return [];
  
  return worker.settings.map(key => {
    for (const section of DEFAULT_SCHEMA.sections) {
      const field = section.fields.find(f => f.key === key);
      if (field) return field;
    }
    return {
      key,
      label: key.split(':')[1] || key,
      type: 'text' as const,
      category: workerName
    };
  });
}