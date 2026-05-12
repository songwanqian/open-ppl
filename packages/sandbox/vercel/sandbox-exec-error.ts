export class SandboxExecError extends Error {
  readonly isInfrastructure: boolean;

  constructor(
    message: string,
    options?: { cause?: unknown; isInfrastructure?: boolean },
  ) {
    super(message, { cause: options?.cause });
    this.name = "SandboxExecError";
    this.isInfrastructure = options?.isInfrastructure ?? false;
  }
}
