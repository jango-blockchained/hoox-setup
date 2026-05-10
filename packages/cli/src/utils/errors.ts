/**
 * CLIError — structured error class for the Hoox CLI.
 * Provides exit codes, optional details, and recoverable flag.
 */

export const enum ExitCode {
  SUCCESS = 0,
  ERROR = 1,
  INVALID_USAGE = 2,
  INFRA_UNAVAILABLE = 3,
}

export class CLIError extends Error {
  constructor(
    message: string,
    public readonly code: ExitCode = ExitCode.ERROR,
    public readonly details?: string,
    public readonly recoverable = false
  ) {
    super(message);
    this.name = "CLIError";
  }
}
