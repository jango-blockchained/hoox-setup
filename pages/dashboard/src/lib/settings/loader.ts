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

export function parseDashboardTOML(
  content: string,
  workerName: string
): WorkerConfigManifest {
  const lines = content.split("\n");
  let displayName = workerName;
  let description = "";
  const sections: DashboardSection[] = [];
  let currentSection = "";
  let currentFields: Record<string, SettingField> = {};
  let currentOptions: Record<string, string[]> = {};
  let currentDescriptions: Record<string, string> = {};
  let currentSectionMeta: Record<string, any> = {};
  let currentBlock = "meta";

  const pushCurrentSection = () => {
    if (currentSection && Object.keys(currentFields).length > 0) {
      sections.push({
        id: currentSection,
        title: currentSectionMeta.title || currentSection.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: currentSectionMeta.description || `Configure ${currentSection} settings`,
        icon: currentSectionMeta.icon,
        priority: currentSectionMeta.priority !== undefined ? currentSectionMeta.priority : sections.length * 10,
        fields: Object.values(currentFields).map(f => {
          const rawKey = f.key.split(":")[1];
          if (currentOptions[rawKey]) {
            f.type = "select";
            f.options = currentOptions[rawKey].map(opt => ({ value: opt, label: opt }));
          }
          if (currentDescriptions[rawKey]) {
            f.description = currentDescriptions[rawKey];
          }
          return f;
        }),
      });
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    if (line.startsWith("display_name")) {
      displayName = line.split("=")[1]?.trim().replace(/^"|"$/g, "") || workerName;
      continue;
    }

    if (line.startsWith("description") && !currentSection) {
      description = line.split("=")[1]?.trim().replace(/^"|"$/g, "") || "";
      continue;
    }

    const sectionMatch = line.match(/^\[sections\.(\w+)\]$/);
    if (sectionMatch) {
      pushCurrentSection();
      currentSection = sectionMatch[1];
      currentFields = {};
      currentOptions = {};
      currentDescriptions = {};
      currentSectionMeta = {};
      currentBlock = "meta";
      continue;
    }

    const blockMatch = line.match(/^\[sections\.(\w+)\.(fields|options|descriptions)\]$/);
    if (blockMatch) {
      currentBlock = blockMatch[2];
      continue;
    }

    const fieldMatch = line.match(/^"([^"]+)"\s*=\s*(.+)$/) || line.match(/^([a-zA-Z0-9_:]+)\s*=\s*(.+)$/);
    if (fieldMatch && currentSection) {
      const key = fieldMatch[1];
      let rawVal = fieldMatch[2].trim();
      let value: string | number | boolean = rawVal.replace(/^"|"$/g, "");

      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (!isNaN(Number(value))) value = Number(value);

      if (currentBlock === "meta") {
         currentSectionMeta[key] = value;
      } else if (currentBlock === "fields") {
         currentFields[key] = createField(currentSection, key, value);
      } else if (currentBlock === "options") {
         // handle array values like ["a", "b"]
         const opts = rawVal.replace(/^\[|\]$/g, "").split(",").map(o => o.trim().replace(/^"|'|"$|'$/g, ""));
         currentOptions[key] = opts.filter(o => o.length > 0);
      } else if (currentBlock === "descriptions") {
         currentDescriptions[key] = String(value);
      }
    }
  }

  pushCurrentSection();

  return {
    worker: workerName,
    displayName,
    description,
    sections: sections.sort((a, b) => a.priority - b.priority),
  };
}

const BUILTIN_CONFIGS: Record<string, () => Promise<WorkerConfigManifest>> = {
  async hoox() {
    const res = await fetch("/workers/hoox.toml");
    if (!res.ok) return { worker: "hoox", displayName: "Gateway", sections: [] };
    return parseDashboardTOML(await res.text(), "hoox");
  },
  async "trade-worker"() {
    const res = await fetch("/workers/trade-worker.toml");
    if (!res.ok) return { worker: "trade-worker", displayName: "Trade Worker", sections: [] };
    return parseDashboardTOML(await res.text(), "trade-worker");
  },
  async "agent-worker"() {
    const res = await fetch("/workers/agent-worker.toml");
    if (!res.ok) return { worker: "agent-worker", displayName: "Agent Worker", sections: [] };
    return parseDashboardTOML(await res.text(), "agent-worker");
  },
  async "telegram-worker"() {
    const res = await fetch("/workers/telegram-worker.toml");
    if (!res.ok) return { worker: "telegram-worker", displayName: "Telegram Worker", sections: [] };
    return parseDashboardTOML(await res.text(), "telegram-worker");
  },
  async "d1-worker"() {
    const res = await fetch("/workers/d1-worker.toml");
    if (!res.ok) return { worker: "d1-worker", displayName: "D1 Worker", sections: [] };
    return parseDashboardTOML(await res.text(), "d1-worker");
  },
  async "email-worker"() {
    const res = await fetch("/workers/email-worker.toml");
    if (!res.ok) return { worker: "email-worker", displayName: "Email Worker", sections: [] };
    return parseDashboardTOML(await res.text(), "email-worker");
  },
};

export async function loadWorkerConfig(
  workerName: string
): Promise<WorkerConfigManifest | null> {
  const loader = BUILTIN_CONFIGS[workerName];
  if (!loader) return null;

  try {
    return await loader();
  } catch {
    return null;
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
      const data = await res.json();
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