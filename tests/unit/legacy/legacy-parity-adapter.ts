import { CreateInvoiceUseCase } from '../../../src/application/use-cases/create-invoice';
import type { InvoiceRepository } from '../../../src/application/ports/invoice-repository';
import type { EventPublisher } from '../../../src/application/ports/event-publisher';
import type { CreateInvoiceDto } from '../../../src/application/dto/create-invoice-dto';
import type { Invoice } from '../../../src/domain/entities/invoice';

interface LegacyInvoiceInput {
  customer_id: string;
  customer_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  amount: string;
  invoice_date: string;
  due_date: string;
  items: string;
}

interface LegacyInvoiceOutput {
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lateFee: number;
  total: number;
  pdfFilename?: string;
}

// Mock implementations for testing
const mockInvoiceRepository: InvoiceRepository = {
  save: async () => {},
  findById: () => Promise.resolve(null),
  findByCustomerId: () => Promise.resolve({ invoices: [] }),
  findByDateRange: () => Promise.resolve({ invoices: [] }),
  exists: () => Promise.resolve(false),
};

const mockEventPublisher: EventPublisher = {
  publish: async () => {},
};

/**
 * Adapter function to convert legacy input to new system and return legacy-compatible output
 */
// Map full state names to state codes
const STATE_NAME_MAP: Record<string, string> = {
  'california': 'CA',
  'new york': 'NY',
  'texas': 'TX',
  'illinois': 'IL',
  'pennsylvania': 'PA',
  'nevada': 'NV',
  'washington': 'WA',
  'florida': 'FL',
  'ohio': 'OH',
  'arizona': 'AZ'
};

export async function calculateLegacyInvoice(input: LegacyInvoiceInput, currentDate?: Date): Promise<LegacyInvoiceOutput> {
  const useCase = new CreateInvoiceUseCase(mockInvoiceRepository, mockEventPublisher);
  
  // Parse various date formats to ISO format (YYYY-MM-DD)
  const parseLegacyDate = (dateStr: string): string => {
    // Already in ISO format
    if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return dateStr;
    }
    
    // MM/DD/YYYY format
    if (dateStr.includes('/')) {
      const [month, day, year] = dateStr.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    
    // MM-DD-YYYY format
    if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const [month, day, year] = dateStr.split('-');
      return `${year}-${month}-${day}`;
    }
    
    throw new Error(`Unsupported date format: ${dateStr}`);
  };
  
  // Parse legacy items format "Description:Quantity:UnitPrice"
  const parseItems = (itemsStr: string): { description: string; quantity: number; unitPrice: number }[] => {
    const parts = itemsStr.split(':');
    if (parts.length === 3) {
      return [{
        description: parts[0],
        quantity: parseInt(parts[1], 10),
        unitPrice: parseFloat(parts[2])
      }];
    }
    // Handle other formats if needed
    return [{
      description: itemsStr,
      quantity: 1,
      unitPrice: parseFloat(input.amount)
    }];
  };
  
  // Normalize state - handle full names and lowercase
  const normalizeState = (state: string): string => {
    const stateLower = state.toLowerCase().trim();
    
    // Check if it's a full state name
    if (STATE_NAME_MAP[stateLower]) {
      return STATE_NAME_MAP[stateLower];
    }
    
    // Otherwise assume it's a state code and uppercase it
    return state.toUpperCase().trim();
  };
  
  const createInvoiceDto: CreateInvoiceDto = {
    invoiceNumber: `INV-${Date.now()}`, // Generate unique invoice number
    customerId: input.customer_id,
    customerName: input.customer_name,
    customerAddress: {
      street: input.address,
      city: input.city,
      state: normalizeState(input.state),
      zip: input.zip,
    },
    invoiceDate: parseLegacyDate(input.invoice_date),
    dueDate: parseLegacyDate(input.due_date),
    items: parseItems(input.items),
  };
  
  try {
    const invoice = await useCase.execute(createInvoiceDto);
    
    
    // Calculate tax rate from tax amount and subtotal
    const subtotalAfterDiscount = invoice.subtotal.getAmount() - invoice.bulkDiscount.getAmount();
    const taxRate = subtotalAfterDiscount > 0 ? invoice.tax.getAmount() / subtotalAfterDiscount : 0;
    
    // Calculate late fee if currentDate is provided
    const lateFee = currentDate ? invoice.calculateLateFee(currentDate).getAmount() : 0;
    const total = Math.round((invoice.total.getAmount() + lateFee) * 100) / 100; // Round to 2 decimal places
    
    // Generate PDF filename in legacy format: CUSTOMERID_YYYY-MM-DD_TOTAL.pdf
    const invoiceDateStr = invoice.invoiceDate.toISOString().split('T')[0];
    const pdfFilename = `${input.customer_id}_${invoiceDateStr}_${total.toFixed(2)}.pdf`;
    
    return {
      subtotal: invoice.subtotal.getAmount(),
      discount: invoice.bulkDiscount.getAmount(),
      taxRate: Math.round(taxRate * 100000) / 100000, // Round to 5 decimal places for better precision
      taxAmount: invoice.tax.getAmount(),
      lateFee: lateFee,
      total: total,
      pdfFilename: pdfFilename
    };
  } catch (error) {
    // Handle minimum invoice amount by returning the minimum
    if (error instanceof Error && error.message.includes('below minimum')) {
      const minAmount = 25.00;
      return {
        subtotal: minAmount,
        discount: 0,
        taxRate: 0,
        taxAmount: 0,
        lateFee: 0,
        total: minAmount,
        pdfFilename: `${input.customer_id}_${parseLegacyDate(input.invoice_date)}_${minAmount.toFixed(2)}.pdf`
      };
    }
    throw error;
  }
}

/**
 * Calculate late fee for a given invoice based on due date
 */
export function calculateLateFee(invoice: Invoice, asOfDate: Date): number {
  return invoice.calculateLateFee(asOfDate).getAmount();
}