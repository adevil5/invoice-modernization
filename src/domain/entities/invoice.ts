import { v4 as uuidv4 } from 'uuid';
import type { Customer } from '../value-objects/customer.js';
import type { InvoiceItem } from '../value-objects/invoice-item.js';
import { Money } from '../value-objects/money.js';
import { InvoiceValidationError } from '../exceptions/invoice-validation-error.js';

interface InvoiceData {
  customer: Customer;
  items: InvoiceItem[];
  invoiceDate: Date;
  dueDate: Date;
}

interface TaxRates {
  [state: string]: number;
}

export class Invoice {
  private readonly id: string;
  private readonly customer: Customer;
  private readonly items: InvoiceItem[];
  private readonly invoiceDate: Date;
  private readonly dueDate: Date;
  private readonly createdAt: Date;
  
  private static readonly MINIMUM_INVOICE_AMOUNT = 25.00;
  private static readonly BULK_DISCOUNT_THRESHOLD = 10000.00;
  private static readonly BULK_DISCOUNT_RATE = 0.03;
  private static readonly Q4_TAX_ADJUSTMENT = 0.02;
  private static readonly LATE_FEE_RATE = 0.015; // 1.5% per month
  private static readonly DEFAULT_TAX_RATE = 0.05;
  
  private static readonly STATE_TAX_RATES: TaxRates = {
    'CA': 0.0725,
    'NY': 0.08,
    'TX': 0.0625,
    'IL': 0.0625,
    'PA': 0.06,
    'NV': 0.0685,
    'WA': 0.065,
    'FL': 0.06,
    'OH': 0.0575,
    'AZ': 0.056
  };
  
  constructor(data: InvoiceData) {
    this.validate(data);
    
    this.id = uuidv4();
    this.customer = data.customer;
    this.items = [...data.items]; // Defensive copy
    this.invoiceDate = new Date(data.invoiceDate.getTime()); // Defensive copy
    this.dueDate = new Date(data.dueDate.getTime()); // Defensive copy
    this.createdAt = new Date();
  }
  
  private validate(data: InvoiceData): void {
    if (!data.customer) {
      throw new InvoiceValidationError('Customer is required', 'customer');
    }
    
    if (!data.items || data.items.length === 0) {
      throw new InvoiceValidationError('At least one item is required', 'items');
    }
    
    if (!data.invoiceDate) {
      throw new InvoiceValidationError('Invoice date is required', 'invoiceDate');
    }
    
    if (!data.dueDate) {
      throw new InvoiceValidationError('Due date is required', 'dueDate');
    }
    
    if (data.dueDate < data.invoiceDate) {
      throw new InvoiceValidationError('Due date cannot be before invoice date', 'dueDate');
    }
    
    // Check for negative amounts in items
    for (const item of data.items) {
      try {
        if (item.getUnitPrice().getAmount() < 0) {
          throw new InvoiceValidationError('Item prices cannot be negative', 'items');
        }
      } catch (error) {
        // Catch Money validation errors and convert to InvoiceValidationError
        if (error instanceof Error && error.message === 'Money amount cannot be negative') {
          throw new InvoiceValidationError('Item prices cannot be negative', 'items');
        }
        throw error;
      }
    }
  }
  
  getId(): string {
    return this.id;
  }
  
  getCustomer(): Customer {
    return this.customer;
  }
  
  getItems(): InvoiceItem[] {
    return [...this.items]; // Return defensive copy
  }
  
  getInvoiceDate(): Date {
    return new Date(this.invoiceDate.getTime()); // Return defensive copy
  }
  
  getDueDate(): Date {
    return new Date(this.dueDate.getTime()); // Return defensive copy
  }
  
  getCreatedAt(): Date {
    return new Date(this.createdAt.getTime()); // Return defensive copy
  }
  
  getSubtotal(): Money {
    const rawSubtotal = this.items.reduce(
      (sum, item) => sum.add(item.getTotal()),
      new Money(0)
    );
    
    // Apply minimum invoice amount
    if (rawSubtotal.getAmount() < Invoice.MINIMUM_INVOICE_AMOUNT) {
      return new Money(Invoice.MINIMUM_INVOICE_AMOUNT);
    }
    
    return rawSubtotal;
  }
  
  getBulkDiscount(): Money {
    const subtotal = this.getSubtotal();
    
    if (subtotal.getAmount() >= Invoice.BULK_DISCOUNT_THRESHOLD) {
      return subtotal.multiply(Invoice.BULK_DISCOUNT_RATE);
    }
    
    return new Money(0);
  }
  
  private getDiscountedSubtotal(): Money {
    return this.getSubtotal().subtract(this.getBulkDiscount());
  }
  
  private getTaxRate(): number {
    // Customer-specific overrides have highest priority
    if (this.customer.isTaxExempt()) {
      return 0;
    }
    
    // Get state-based rate or default
    const state = this.customer.getAddress().getState().toUpperCase();
    const baseRate = Invoice.STATE_TAX_RATES[state] || Invoice.DEFAULT_TAX_RATE;
    
    // Apply Q4 adjustment if applicable
    const month = this.invoiceDate.getMonth();
    const isQ4 = month >= 9 && month <= 11; // October (9), November (10), December (11)
    
    if (isQ4) {
      return baseRate + Invoice.Q4_TAX_ADJUSTMENT;
    }
    
    return baseRate;
  }
  
  calculateTax(): Money {
    const discountedSubtotal = this.getDiscountedSubtotal();
    const taxRate = this.getTaxRate();
    return discountedSubtotal.multiply(taxRate);
  }
  
  getTotal(): Money {
    const discountedSubtotal = this.getDiscountedSubtotal();
    const tax = this.calculateTax();
    return discountedSubtotal.add(tax);
  }
  
  calculateLateFee(asOfDate: Date): Money {
    // Calculate days past due date
    const daysPastDue = Math.floor(
      (asOfDate.getTime() - this.dueDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    // No late fee if less than 30 days past due
    if (daysPastDue < 30) {
      return new Money(0);
    }
    
    // Calculate months late (any partial month counts as full month)
    // Days 30-59 = 1 month, 60-89 = 2 months, etc.
    const monthsLate = Math.ceil((daysPastDue - 29) / 30);
    
    // Calculate late fee on total invoice amount (including tax)
    const total = this.getTotal();
    return total.multiply(Invoice.LATE_FEE_RATE * monthsLate);
  }
}