import { print_warning } from "../../utils.js";

export interface WizardContext {
  step: number;
  totalSteps: number;
  data: Record<string, unknown>;
  verbose: boolean;
}

export interface WizardStep {
  name: string;
  validate: (ctx: WizardContext) => Promise<{ valid: boolean; errors: string[] }>;
  execute: (ctx: WizardContext) => Promise<void>;
  rollback?: (ctx: WizardContext) => Promise<void>;
}

export function createContext(
  step: number,
  totalSteps: number,
  verbose = false
): WizardContext {
  return {
    step,
    totalSteps,
    data: {},
    verbose,
  };
}

export async function runStep(
  step: WizardStep,
  ctx: WizardContext
): Promise<{ success: boolean; error?: string }> {
  const validation = await step.validate(ctx);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.errors.join(", "),
    };
  }

  try {
    await step.execute(ctx);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}