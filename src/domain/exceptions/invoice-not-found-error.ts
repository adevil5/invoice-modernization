/**
 * Error thrown when an invoice is not found.
 */
export class InvoiceNotFoundError extends Error {
  constructor(invoiceNumber: string) {
    super(`Invoice not found: ${invoiceNumber}`);
    this.name = 'InvoiceNotFoundError';
    Object.setPrototypeOf(this, InvoiceNotFoundError.prototype);
  }
}