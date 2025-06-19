import type { Invoice } from '../../domain/entities/invoice.js';

/**
 * Port interface for invoice persistence.
 * Infrastructure adapters must implement this interface.
 */
export interface InvoiceRepository {
  /**
   * Save an invoice to the repository.
   * @param invoice - The invoice to save
   * @throws Error if save operation fails
   */
  save(invoice: Invoice): Promise<void>;

  /**
   * Find an invoice by its unique invoice number.
   * @param invoiceNumber - The unique invoice number
   * @returns The invoice if found, null otherwise
   */
  findById(invoiceNumber: string): Promise<Invoice | null>;

  /**
   * Find all invoices for a specific customer.
   * @param customerId - The customer ID
   * @param options - Optional pagination and sorting options
   * @returns Array of invoices for the customer
   */
  findByCustomerId(
    customerId: string,
    options?: {
      limit?: number;
      cursor?: string;
      sortBy?: 'date' | 'total';
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{
    invoices: Invoice[];
    nextCursor?: string;
  }>;

  /**
   * Find invoices within a date range.
   * @param startDate - Start date (inclusive)
   * @param endDate - End date (inclusive)
   * @param options - Optional pagination and filtering options
   * @returns Array of invoices within the date range
   */
  findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: {
      limit?: number;
      cursor?: string;
      customerId?: string;
      status?: 'pending' | 'paid' | 'overdue';
    }
  ): Promise<{
    invoices: Invoice[];
    nextCursor?: string;
  }>;

  /**
   * Check if an invoice with the given number already exists.
   * @param invoiceNumber - The invoice number to check
   * @returns True if exists, false otherwise
   */
  exists(invoiceNumber: string): Promise<boolean>;
}