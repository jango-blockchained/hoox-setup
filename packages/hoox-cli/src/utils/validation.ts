export interface ValidationResult {
  name: string;
  success: boolean;
  errors: string[];
  warnings: string[];
  addError: (message: string) => void;
  addWarning: (message: string) => void;
}

export interface ValidationContext {
  cwd: string;
  workersConfig: Record<string, unknown>;
  isInteractive: boolean;
}

export function createValidationResult(name: string): ValidationResult {
  const result: ValidationResult = {
    name,
    success: true,
    errors: [],
    warnings: [],
    addError(message: string) {
      this.errors.push(message);
      this.success = false;
    },
    addWarning(message: string) {
      this.warnings.push(message);
    },
  };
  return result;
}

export function formatValidationResults(results: ValidationResult[]): string {
  const lines: string[] = [];
  for (const r of results) {
    const icon = r.success ? "✓" : "✗";
    lines.push(`${icon} ${r.name}`);
    for (const e of r.errors) lines.push(`  ✗ ${e}`);
    for (const w of r.warnings) lines.push(`  ⚠ ${w}`);
  }
  return lines.join("\n");
}
