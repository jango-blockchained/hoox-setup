import { DEFAULT_SCHEMA, type ConfigSchema, type ConfigField } from './config';
import { Fetcher, KVNamespace } from '@cloudflare/workers-types';

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
    settings: ['global:kill_switch', 'webhook:tradingview:ip_check_enabled', 'webhook:tradingview:allowed_ips'],
    enabled: false
  },
  {
    name: 'trade-worker',
    displayName: 'Trade Worker',
    description: 'Exchange trade execution',
    settings: ['trade:default_leverage', 'trade:max_position_size'],
    enabled: false
  },
  {
    name: 'agent-worker',
    displayName: 'Agent Worker',
    description: 'AI agent and risk management',
    settings: ['agent:default_provider', 'agent:timeout_ms', 'agent:retry_count'],
    enabled: false
  },
  {
    name: 'telegram-worker',
    displayName: 'Telegram Worker',
    description: 'Telegram notifications',
    settings: ['notify:telegram_enabled'],
    enabled: false
  },
  {
    name: 'd1-worker',
    displayName: 'D1 Worker',
    description: 'Database service',
    settings: [],
    enabled: false
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
  
  if (kv) {
    for (const section of schema.sections) {
      for (const field of section.fields) {
        const value = await kv.get(field.key);
        if (value !== null) {
          try {
            loadedValues[field.key] = JSON.parse(value);
          } catch {
            loadedValues[field.key] = value;
          }
        } else if (field.value !== undefined) {
          loadedValues[field.key] = field.value;
        }
      }
    }
  }
  
  const detectedWorkers = workerConfigs.map(w => ({
    ...w,
    enabled: (services[w.name + '_SERVICE'] !== undefined) ||
             (services[w.name + '_WORKER'] !== undefined) ||
             (w.name === 'hoox')
  }));
  
  return {
    schema: {
      ...schema,
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
  const currentValue = value !== undefined ? String(value) : (field.value !== undefined ? String(field.value) : '');
  
  switch (field.type) {
    case 'boolean':
      return `
        <label class="flex items-center space-x-3">
          <input type="checkbox" 
                 name="${fieldName}" 
                 value="true" 
                 ${currentValue === 'true' ? 'checked' : ''} 
                 class="form-checkbox h-5 w-5 text-orange-500 rounded bg-neutral-900 border-neutral-700" />
          <span class="text-neutral-200">${field.description || 'Enable'}</span>
        </label>
      `;
    
    case 'number':
      return `
        <input type="number" 
               name="${fieldName}" 
               value="${currentValue}" 
               placeholder="${field.placeholder || ''}"
               step="any"
               class="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-sm text-neutral-300 focus:border-orange-500 outline-none" />
      `;
    
    case 'select':
      const options = field.options?.map(opt => 
        `<option value="${opt.value}" ${String(opt.value) === currentValue ? 'selected' : ''}>${opt.label}</option>`
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
        <p class="text-xs text-neutral-500 mt-1">${field.description || 'Valid JSON required'}</p>
      `;
    
    case 'textarea':
      return `
        <textarea name="${fieldName}" 
                  rows="3" 
                  class="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-sm text-neutral-300 focus:border-orange-500 outline-none">${currentValue}</textarea>
        ${field.description ? `<p class="text-xs text-neutral-500 mt-1">${field.description}</p>` : ''}
      `;
    
    default:
      return `
        <input type="text" 
               name="${fieldName}" 
               value="${currentValue}" 
               placeholder="${field.placeholder || ''}"
               class="w-full bg-neutral-950 border border-neutral-700 rounded p-2 text-sm text-neutral-300 focus:border-orange-500 outline-none" />
        ${field.description ? `<p class="text-xs text-neutral-500 mt-1">${field.description}</p>` : ''}
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
  
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('_')) continue;
    if (typeof value !== 'string') continue;
    
    if (value === 'true') {
      updates[key] = true;
    } else if (value === 'false' || value === '') {
      continue;
    } else if (value === 'on') {
      updates[key] = true;
    } else {
      try {
        updates[key] = JSON.parse(value as string);
      } catch {
        updates[key] = value;
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