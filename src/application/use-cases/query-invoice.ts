import type { Invoice } from '../../domain/entities/invoice';
import { InvoiceNotFoundError } from '../../domain/exceptions/invoice-not-found-error';
import { InvoiceValidationError } from '../../domain/exceptions/invoice-validation-error';
import type { InvoiceRepository, FindResult } from '../ports/invoice-repository';
import type {
  QueryInvoiceDto,
  QueryInvoiceByIdDto,
  QueryInvoiceResponse
} from '../dto/query-invoice-dto';

/**
 * Use case for querying invoices.
 * Supports single invoice retrieval and paginated list queries with filtering.
 */
export class QueryInvoiceUseCase {
  private static readonly DEFAULT_LIMIT = 20;
  private static readonly MAX_LIMIT = 100;
  private static readonly DEFAULT_DATE_RANGE_DAYS = 90;

  constructor(private readonly invoiceRepository: InvoiceRepository) {}

  /**
   * Query a single invoice by its ID.
   * @param dto - The DTO containing the invoice number
   * @returns The invoice details
   * @throws InvoiceNotFoundError if the invoice doesn't exist
   * @throws InvoiceValidationError if the invoice number is invalid
   */
  async queryById(dto: QueryInvoiceByIdDto): Promise<{
    invoiceNumber: string;
    customerId: string;
    customerName: string;
    customerAddress: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    invoiceDate: string;
    dueDate: string;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    status: 'pending' | 'paid' | 'overdue';
  }> {
    // Validate invoice number
    if (!dto.invoiceNumber || dto.invoiceNumber.trim() === '') {
      throw new InvoiceValidationError('Invoice number is required');
    }

    // Retrieve the invoice
    const invoice = await this.invoiceRepository.findById(dto.invoiceNumber);
    if (!invoice) {
      throw new InvoiceNotFoundError(dto.invoiceNumber);
    }

    // Transform to response format
    return this.transformInvoiceToDetail(invoice);
  }

  /**
   * Query invoices with pagination and filtering.
   * @param dto - The query parameters
   * @returns Paginated list of invoices
   * @throws InvoiceValidationError if query parameters are invalid
   */
  async query(dto: QueryInvoiceDto): Promise<QueryInvoiceResponse> {
    // Validate and normalize parameters
    const normalizedParams = this.validateAndNormalizeQueryParams(dto);

    let result: FindResult;

    // Query by customer ID if specified
    if (normalizedParams.customerId) {
      const options: Parameters<InvoiceRepository['findByCustomerId']>[1] = {
        limit: normalizedParams.limit
      };
      
      if (normalizedParams.cursor) {options.cursor = normalizedParams.cursor;}
      if (normalizedParams.sortBy) {options.sortBy = normalizedParams.sortBy;}
      if (normalizedParams.sortOrder) {options.sortOrder = normalizedParams.sortOrder;}
      
      result = await this.invoiceRepository.findByCustomerId(
        normalizedParams.customerId,
        options
      );
    } else {
      // Query by date range
      const options: Parameters<InvoiceRepository['findByDateRange']>[2] = {
        limit: normalizedParams.limit
      };
      
      if (normalizedParams.cursor) {options.cursor = normalizedParams.cursor;}
      if (normalizedParams.customerId) {options.customerId = normalizedParams.customerId;}
      if (normalizedParams.status) {options.status = normalizedParams.status;}
      
      result = await this.invoiceRepository.findByDateRange(
        normalizedParams.startDate,
        normalizedParams.endDate,
        options
      );
    }

    // Transform to response format
    const response: QueryInvoiceResponse = {
      invoices: result.invoices.map((invoice: Invoice) => this.transformInvoiceToSummary(invoice))
    };
    
    if (result.nextCursor) {
      response.nextCursor = result.nextCursor;
    }
    
    return response;
  }

  /**
   * Validate and normalize query parameters.
   * @param dto - The raw query parameters
   * @returns Normalized parameters with defaults applied
   * @throws InvoiceValidationError if validation fails
   */
  private validateAndNormalizeQueryParams(dto: QueryInvoiceDto): {
    limit: number;
    cursor?: string;
    customerId?: string;
    status?: 'pending' | 'paid' | 'overdue';
    startDate: Date;
    endDate: Date;
    sortBy?: 'date' | 'total';
    sortOrder?: 'asc' | 'desc';
  } {
    // Validate limit
    const limit = dto.limit ?? QueryInvoiceUseCase.DEFAULT_LIMIT;
    if (limit <= 0 || limit > QueryInvoiceUseCase.MAX_LIMIT) {
      throw new InvoiceValidationError(
        `Limit must be between 1 and ${QueryInvoiceUseCase.MAX_LIMIT}`
      );
    }

    // Parse and validate dates
    let startDate: Date;
    let endDate: Date;

    if (dto.startDate || dto.endDate) {
      // If either date is specified, both are required
      if (!dto.startDate || !dto.endDate) {
        throw new InvoiceValidationError(
          'Both startDate and endDate must be provided when filtering by date'
        );
      }

      // Parse dates at noon to avoid timezone issues
      startDate = new Date(dto.startDate + 'T12:00:00');
      endDate = new Date(dto.endDate + 'T12:00:00');

      if (isNaN(startDate.getTime())) {
        throw new InvoiceValidationError('Invalid startDate format. Use YYYY-MM-DD');
      }

      if (isNaN(endDate.getTime())) {
        throw new InvoiceValidationError('Invalid endDate format. Use YYYY-MM-DD');
      }

      if (startDate > endDate) {
        throw new InvoiceValidationError('startDate must be before or equal to endDate');
      }
    } else {
      // Default to last 90 days
      endDate = new Date();
      endDate.setHours(12, 0, 0, 0);
      
      startDate = new Date();
      startDate.setDate(startDate.getDate() - QueryInvoiceUseCase.DEFAULT_DATE_RANGE_DAYS);
      startDate.setHours(12, 0, 0, 0);
    }

    const result: {
      limit: number;
      cursor?: string;
      customerId?: string;
      status?: 'pending' | 'paid' | 'overdue';
      startDate: Date;
      endDate: Date;
      sortBy?: 'date' | 'total';
      sortOrder?: 'asc' | 'desc';
    } = {
      limit,
      startDate,
      endDate
    };
    
    if (dto.cursor) {result.cursor = dto.cursor;}
    if (dto.customerId) {result.customerId = dto.customerId;}
    if (dto.status) {result.status = dto.status;}
    if (dto.sortBy) {result.sortBy = dto.sortBy;}
    if (dto.sortOrder) {result.sortOrder = dto.sortOrder;}
    
    return result;
  }

  /**
   * Transform an invoice entity to a summary format.
   * @param invoice - The invoice entity
   * @returns Invoice summary for list views
   */
  private transformInvoiceToSummary(invoice: Invoice): {
    invoiceNumber: string;
    customerId: string;
    customerName: string;
    invoiceDate: string;
    dueDate: string;
    total: number;
    status: 'pending' | 'paid' | 'overdue';
  } {
    return {
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customer.getId(),
      customerName: invoice.customer.getName(),
      invoiceDate: invoice.invoiceDate.toISOString().split('T')[0] ?? '',
      dueDate: invoice.dueDate.toISOString().split('T')[0] ?? '',
      total: invoice.total.getAmount(),
      status: this.determineInvoiceStatus(invoice)
    };
  }

  /**
   * Transform an invoice entity to detailed format.
   * @param invoice - The invoice entity
   * @returns Detailed invoice information
   */
  private transformInvoiceToDetail(invoice: Invoice): {
    invoiceNumber: string;
    customerId: string;
    customerName: string;
    customerAddress: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    invoiceDate: string;
    dueDate: string;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    subtotal: number;
    tax: number;
    total: number;
    status: 'pending' | 'paid' | 'overdue';
  } {
    const address = invoice.customer.getAddress();
    
    return {
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customer.getId(),
      customerName: invoice.customer.getName(),
      customerAddress: {
        street: address.getStreet(),
        city: address.getCity(),
        state: address.getState(),
        zip: address.getZip()
      },
      invoiceDate: invoice.invoiceDate.toISOString().split('T')[0] ?? '',
      dueDate: invoice.dueDate.toISOString().split('T')[0] ?? '',
      items: invoice.items.map(item => ({
        description: item.getDescription(),
        quantity: item.getQuantity(),
        unitPrice: item.getUnitPrice().getAmount(),
        total: item.getTotal().getAmount()
      })),
      subtotal: invoice.subtotal.getAmount(),
      tax: invoice.tax.getAmount(),
      total: invoice.total.getAmount(),
      status: this.determineInvoiceStatus(invoice)
    };
  }

  /**
   * Determine the current status of an invoice.
   * @param invoice - The invoice to check
   * @returns The invoice status
   */
  private determineInvoiceStatus(invoice: Invoice): 'pending' | 'paid' | 'overdue' {
    // For now, we'll determine status based on due date
    // In a real system, this would check payment records
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const dueDate = new Date(invoice.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    if (dueDate < today) {
      return 'overdue';
    }
    
    // Default to pending for this implementation
    // A real system would check if payment has been received
    return 'pending';
  }
}