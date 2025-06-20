/**
 * Data transfer object for querying invoices.
 * Supports pagination, filtering, and sorting.
 */
export interface QueryInvoiceDto {
  /**
   * Maximum number of invoices to return (default: 20, max: 100)
   */
  limit?: number;

  /**
   * Cursor for pagination (from previous response)
   */
  cursor?: string;

  /**
   * Filter by customer ID
   */
  customerId?: string;

  /**
   * Filter by invoice status
   */
  status?: 'pending' | 'paid' | 'overdue';

  /**
   * Filter by date range - start date (inclusive)
   * Format: YYYY-MM-DD
   */
  startDate?: string;

  /**
   * Filter by date range - end date (inclusive)
   * Format: YYYY-MM-DD
   */
  endDate?: string;

  /**
   * Sort field
   */
  sortBy?: 'date' | 'total';

  /**
   * Sort order
   */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Data transfer object for querying a single invoice by ID.
 */
export interface QueryInvoiceByIdDto {
  /**
   * The invoice number/ID to retrieve
   */
  invoiceNumber: string;
}

/**
 * Response structure for paginated invoice queries.
 */
export interface QueryInvoiceResponse {
  /**
   * List of invoices matching the query
   */
  invoices: Array<{
    invoiceNumber: string;
    customerId: string;
    customerName: string;
    invoiceDate: string;
    dueDate: string;
    total: number;
    status: 'pending' | 'paid' | 'overdue';
  }>;

  /**
   * Cursor for retrieving the next page of results
   */
  nextCursor?: string;

  /**
   * Total count of matching invoices (if available)
   */
  totalCount?: number;
}