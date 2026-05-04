export class CLIError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = true
  ) {
    super(message);
    this.name = "CLIError";
  }
}

export class WorkerDeployError extends CLIError {
  constructor(worker: string, cause: Error) {
    super(`Failed to deploy ${worker}: ${cause.message}`, "DEPLOY_FAILED");
    this.cause = cause;
  }
}

export class ConfigValidationError extends CLIError {
  constructor(field: string) {
    super(`Invalid configuration: ${field} is required`, "CONFIG_INVALID");
  }
}
