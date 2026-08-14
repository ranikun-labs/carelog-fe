export type CarelogErrorKind = 'HTTP' | 'NETWORK' | 'PROTOCOL' | 'CONFIGURATION';

export class CarelogError extends Error {
  readonly kind: CarelogErrorKind;

  constructor(kind: CarelogErrorKind, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CarelogError';
    this.kind = kind;
  }
}

export class CarelogConfigurationError extends CarelogError {
  constructor(message: string) {
    super('CONFIGURATION', message);
    this.name = 'CarelogConfigurationError';
  }
}

export class CarelogNetworkError extends CarelogError {
  constructor(message: string, options?: ErrorOptions) {
    super('NETWORK', message, options);
    this.name = 'CarelogNetworkError';
  }
}

export class CarelogProtocolError extends CarelogError {
  readonly payload?: unknown;

  constructor(message: string, payload?: unknown) {
    super('PROTOCOL', message);
    this.name = 'CarelogProtocolError';
    this.payload = payload;
  }
}

export class CarelogHttpError extends CarelogError {
  readonly status: number;
  readonly body?: unknown;

  constructor(status: number, body?: unknown) {
    super('HTTP', `Carelog API request failed with HTTP ${status}.`);
    this.name = 'CarelogHttpError';
    this.status = status;
    this.body = body;
  }
}

export function isCarelogError(error: unknown): error is CarelogError {
  return error instanceof CarelogError;
}

export function getCarelogHttpStatus(error: unknown): number | undefined {
  return error instanceof CarelogHttpError ? error.status : undefined;
}
