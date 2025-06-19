export class InvoiceValidationError extends Error {
  constructor(message: string, public readonly field?: string) {
    super(message);
    this.name = 'InvoiceValidationError';
    Object.setPrototypeOf(this, InvoiceValidationError.prototype);
  }
}