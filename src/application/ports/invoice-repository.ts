import type { Invoice } from '@domain/entities/invoice';

/**
 * Options for find operations with pagination and sorting.
 */
export interface FindOptions {
  limit?: number;
  cursor?: string;
  sortBy?: 'date' | 'total';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Options for date range queries.
 */
export interface DateRangeOptions extends FindOptions {
  customerId?: string;
  status?: 'pending' | 'paid' | 'overdue';
}

/**
 * Result of find operations with pagination support.
 */
export interface FindResult {
  invoices: Invoice[];
  nextCursor?: string | undefined;
}

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
    options?: FindOptions
  ): Promise<FindResult>;

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
    options?: DateRangeOptions
  ): Promise<FindResult>;

  /**
   * Check if an invoice with the given number already exists.
   * @param invoiceNumber - The invoice number to check
   * @returns True if exists, false otherwise
   */
  exists(invoiceNumber: string): Promise<boolean>;
}