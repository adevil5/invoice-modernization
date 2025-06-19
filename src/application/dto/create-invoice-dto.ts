/**
 * DTO for address information.
 */
export interface AddressDto {
  street: string;
  city: string;
  state: string;
  zip: string;
}

/**
 * DTO for invoice item information.
 */
export interface InvoiceItemDto {
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * DTO for creating a new invoice.
 * This represents the input data for the CreateInvoice use case.
 */
export interface CreateInvoiceDto {
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerAddress: AddressDto;
  invoiceDate: string; // ISO date string (YYYY-MM-DD)
  dueDate: string; // ISO date string (YYYY-MM-DD)
  items: InvoiceItemDto[];
  customerTaxOverride?: number; // Optional tax rate override for the customer
}