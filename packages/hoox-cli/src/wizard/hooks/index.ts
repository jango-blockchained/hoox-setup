import type { WizardContext } from "../core.js";
import { print_warning, print_info } from "../../utils.js";

export function useValidation(
  stepName: string,
  validators: Array<() => Promise<{ valid: boolean; error: string }>>
) {
  return async (
    ctx: WizardContext
  ): Promise<{ valid: boolean; errors: string[] }> => {
    const errors: string[] = [];

    for (const validator of validators) {
      try {
        const result = await validator();
        if (!result.valid) {
          errors.push(result.error);
        }
      } catch (e) {
        errors.push(
          `${stepName}: ${e instanceof Error ? e.message : String(e)}`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  };
}

export function useAutoSave(savePath: string) {
  return async (ctx: WizardContext): Promise<void> => {
    try {
      const content = JSON.stringify(ctx.data, null, 2);
      await Bun.write(savePath, content);
      if (ctx.verbose) {
        print_info(`Auto-saved state to ${savePath}`);
      }
    } catch (e) {
      print_warning(
        `Failed to auto-save: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  };
}

export function useVerboseLogging() {
  return (ctx: WizardContext, message: string): void => {
    if (ctx.verbose) {
      print_info(`[Step ${ctx.step}/${ctx.totalSteps}] ${message}`);
    }
  };
}

export function createValidationError(
  step: string,
  message: string
): { valid: boolean; error: string } {
  return { valid: false, error: `${step}: ${message}` };
}

export function createValidationSuccess(): { valid: boolean; error: string } {
  return { valid: true, error: "" };
}
