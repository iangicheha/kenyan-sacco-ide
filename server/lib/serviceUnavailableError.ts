export class ServiceUnavailableError extends Error {
  readonly statusCode = 503;

  constructor(message: string, public readonly details?: Record<string, unknown>) {
    super(message);
    this.name = "ServiceUnavailableError";
  }
}

export function isServiceUnavailableError(error: unknown): error is ServiceUnavailableError {
  return error instanceof ServiceUnavailableError;
}
