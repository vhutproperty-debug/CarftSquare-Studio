export class ContactAccessError extends Error {
  status = 403;

  constructor(message: string) {
    super(message);
    this.name = 'ContactAccessError';
  }
}

export class ContactValidationError extends Error {
  status = 400;

  constructor(message: string) {
    super(message);
    this.name = 'ContactValidationError';
  }
}

export function isDuplicateKey(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: number }).code === 11000);
}
