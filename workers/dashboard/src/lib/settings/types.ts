export type FieldType =
  | "boolean"
  | "number"
  | "text"
  | "select"
  | "json"
  | "textarea";

export interface SettingOption {
  value: string;
  label: string;
}

export interface SettingField {
  key: string;
  label: string;
  description?: string;
  type: FieldType;
  default: string | number | boolean;
  options?: SettingOption[];
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    required?: boolean;
  };
}

export interface DashboardSection {
  id: string;
  title: string;
  description: string;
  icon?: string;
  priority: number;
  fields: SettingField[];
}

export interface DashboardComponent {
  id: string;
  title: string;
  type: "table" | "chart" | "card" | "metric";
  priority: number;
  props: Record<string, unknown>;
}

export interface WorkerDashboardConfig {
  worker: string;
  displayName: string;
  description?: string;
  sections: DashboardSection[];
  components?: DashboardComponent[];
}

export interface MergedSettings {
  [worker: string]: {
    [key: string]: string | number | boolean;
  };
}

export interface SettingsUpdateRequest {
  worker: string;
  key: string;
  value: string | number | boolean;
}
