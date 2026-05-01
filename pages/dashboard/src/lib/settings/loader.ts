import type {
  DashboardSection,
  WorkerDashboardConfig,
  MergedSettings,
  SettingField,
  SettingOption,
} from "./types";

export interface WorkerConfigManifest {
  worker: string;
  displayName: string;
  description?: string;
  sections: DashboardSection[];
}
interface ParsedSection {
  title?: string;
  description?: string;
  icon?: string;
  priority?: number;
  fields?: Record<string, string | number | boolean>;
  options?: Record<string, string[]>;
  descriptions?: Record<string, string>;
}

function parseFieldValue(value: string | number | boolean): SettingField["type"] {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (value === "true" || value === "false") return "boolean";
  if (!isNaN(Number(value))) return "number";
  return "text";
}

function createField(
  sectionId: string,
  key: string,
  value: string | number | boolean,
  options?: string[]
): SettingField {
  const type = options ? "select" : parseFieldValue(value);
  const field: SettingField = {
    key: `${sectionId}:${key}`,
    label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    type: type as SettingField["type"],
    default: value,
    placeholder: String(value),
  };

  if (options) {
    field.type = "select";
    field.options = options.map((opt) => ({ value: opt, label: opt }));
  }

  return field;
}

export function parseDashboardJSONC(
  content: string,
  workerName: string
): WorkerConfigManifest {
  try {
    // Strip comments to safely parse JSONC
    const cleanContent = content.replace(/\/\/.*|\/\*[\s\S]*?\*\//g, "");
    const parsed = JSON.parse(cleanContent) as {
      display_name?: string;
      displayName?: string;
      description?: string;
      sections?: Record<string, ParsedSection>;
    };

    const displayName = parsed.display_name || parsed.displayName || workerName;
    const description = parsed.description || "";
    const sections: DashboardSection[] = [];

    if (parsed.sections) {
      for (const [sectionId, sectionData] of Object.entries(parsed.sections)) {
        const fields: SettingField[] = [];
        const sectionFields = sectionData.fields || {};
        const sectionOptions = sectionData.options || {};
        const sectionDescriptions = sectionData.descriptions || {};

        for (const [key, value] of Object.entries(sectionFields)) {
          const field = createField(sectionId, key, value as string | number | boolean);
          
          if (sectionOptions[key]) {
            field.type = "select";
            field.options = sectionOptions[key].map((opt: string) => ({ value: opt, label: opt }));
          }
          
          if (sectionDescriptions[key]) {
            field.description = String(sectionDescriptions[key]);
          }
          
          fields.push(field);
        }

        sections.push({
          id: sectionId,
          title: sectionData.title || sectionId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          description: sectionData.description || `Configure ${sectionId} settings`,
          icon: sectionData.icon,
          priority: sectionData.priority !== undefined ? sectionData.priority : sections.length * 10,
          fields,
        });
      }
    }

    return {
      worker: workerName,
      displayName,
      description,
      sections: sections.sort((a, b) => a.priority - b.priority),
    };
  } catch (error) {
    console.error(`Failed to parse dashboard.jsonc for ${workerName}:`, error);
    return {
      worker: workerName,
      displayName: workerName,
      description: "Failed to load configuration",
      sections: [],
    };
  }
}

const BUILTIN_CONFIGS: Record<string, () => Promise<WorkerConfigManifest>> = {
  async hoox() {
    const res = await fetch("/workers/hoox.jsonc");
    if (!res.ok) return { worker: "hoox", displayName: "Gateway", sections: [] };
    return parseDashboardJSONC(await res.text(), "hoox");
  },
  async "trade-worker"() {
    const res = await fetch("/workers/trade-worker.jsonc");
    if (!res.ok) return { worker: "trade-worker", displayName: "Trade Worker", sections: [] };
    return parseDashboardJSONC(await res.text(), "trade-worker");
  },
  async "agent-worker"() {
    const res = await fetch("/workers/agent-worker.jsonc");
    if (!res.ok) return { worker: "agent-worker", displayName: "Agent Worker", sections: [] };
    return parseDashboardJSONC(await res.text(), "agent-worker");
  },
  async "telegram-worker"() {
    const res = await fetch("/workers/telegram-worker.jsonc");
    if (!res.ok) return { worker: "telegram-worker", displayName: "Telegram Worker", sections: [] };
    return parseDashboardJSONC(await res.text(), "telegram-worker");
  },
  async "d1-worker"() {
    const res = await fetch("/workers/d1-worker.jsonc");
    if (!res.ok) return { worker: "d1-worker", displayName: "D1 Worker", sections: [] };
    return parseDashboardJSONC(await res.text(), "d1-worker");
  },
  async "email-worker"() {
    const res = await fetch("/workers/email-worker.jsonc");
    if (!res.ok) return { worker: "email-worker", displayName: "Email Worker", sections: [] };
    return parseDashboardJSONC(await res.text(), "email-worker");
  },
  async "web3-wallet-worker"() {
    const res = await fetch("/workers/web3-wallet-worker.jsonc");
    if (!res.ok) return { worker: "web3-wallet-worker", displayName: "Web3 Wallet", sections: [] };
    return parseDashboardJSONC(await res.text(), "web3-wallet-worker");
  },
};

export async function loadWorkerConfig(
  workerName: string
): Promise<WorkerConfigManifest | null> {
  const loader = BUILTIN_CONFIGS[workerName];
  if (!loader) {
    console.warn(`No config loader found for worker: ${workerName}`);
    return null;
  }

  try {
    return await loader();
  } catch (error) {
    console.error(`Failed to load config for worker ${workerName}:`, error);
    return {
      worker: workerName,
      displayName: workerName,
      description: "Configuration unavailable",
      sections: [],
    };
  }
}

export async function loadAllConfigs(
  workerNames: string[]
): Promise<WorkerConfigManifest[]> {
  const configs = await Promise.all(
    workerNames.map((name) => loadWorkerConfig(name))
  );

  return configs.filter((c): c is WorkerConfigManifest => c !== null && c.sections.length > 0);
}

export function flattenSettings(
  configs: WorkerConfigManifest[]
): MergedSettings {
  const merged: MergedSettings = {};

  for (const config of configs) {
    merged[config.worker] = {};

    for (const section of config.sections) {
      for (const field of section.fields) {
        merged[config.worker][field.key] = field.default;
      }
    }
  }

  return merged;
}

export async function getRuntimeOverrides(
  workerNames: string[]
): Promise<Record<string, string | number | boolean>> {
  try {
    const res = await fetch(`/api/settings`);
    if (res.ok) {
      const data = await res.json() as { settings?: Record<string, string | number | boolean> };
      return data.settings || {};
    }
  } catch {
    // API unavailable, return empty
  }
  return {};
}

export async function loadMergedSettings(
  workerNames: string[]
): Promise<MergedSettings> {
  const configs = await loadAllConfigs(workerNames);
  const defaults = flattenSettings(configs);
  const overrides = (await getRuntimeOverrides(workerNames)) as unknown as Record<string, Record<string, any>>;

  const merged: MergedSettings = {};

  for (const [worker, fields] of Object.entries(defaults)) {
    merged[worker] = { ...fields };

    for (const key of Object.keys(fields)) {
      if (overrides[worker]) {
        const rawKey = key.split(":")[1] || key;
        if (overrides[worker][rawKey] !== undefined) {
          merged[worker][key] = overrides[worker][rawKey];
        } else if (overrides[worker][key] !== undefined) {
          merged[worker][key] = overrides[worker][key];
        }
      }
    }
  }

  return merged;
}
