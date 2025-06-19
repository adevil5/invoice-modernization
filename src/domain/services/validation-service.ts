import type { ValidationError } from '../exceptions/validation-errors.js';
import { FieldValidationError, BusinessRuleViolationError } from '../exceptions/validation-errors.js';
import type { Customer } from '../value-objects/customer.js';
import type { InvoiceItem } from '../value-objects/invoice-item.js';
import { Money } from '../value-objects/money.js';

interface InvoiceData {
  customer: Customer | null;
  items: InvoiceItem[];
  invoiceDate: Date | null;
  dueDate: Date | null;
}

interface CustomerData {
  id: string;
  name: string;
  address: AddressData | null;
}

interface AddressData {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface InvoiceItemData {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface CSVRow {
  customer_id?: string;
  customer_name?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  amount?: string;
  invoice_date?: string;
  due_date?: string;
  items?: string;
}

export class ValidationService {
  private static readonly MINIMUM_INVOICE_AMOUNT = 25.00;
  private static readonly LARGE_INVOICE_THRESHOLD = 100000.00;
  private static readonly VALID_STATE_CODES = [
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
  ];

  validateInvoiceData(data: InvoiceData): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required field validations
    if (!data.customer) {
      errors.push(new FieldValidationError('customer', 'Customer is required'));
    }

    if (!data.items || data.items.length === 0) {
      errors.push(new FieldValidationError('items', 'At least one item is required'));
    }

    if (!data.invoiceDate) {
      errors.push(new FieldValidationError('invoiceDate', 'Invoice date is required'));
    }

    if (!data.dueDate) {
      errors.push(new FieldValidationError('dueDate', 'Due date is required'));
    }

    // Business rule validations (only if both dates are present)
    if (data.invoiceDate && data.dueDate && data.dueDate < data.invoiceDate) {
      errors.push(new BusinessRuleViolationError(
        'DUE_DATE_BEFORE_INVOICE_DATE',
        'Due date cannot be before invoice date'
      ));
    }

    return errors;
  }

  validateCustomerData(data: CustomerData): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!data.id?.trim()) {
      errors.push(new FieldValidationError('customer.id', 'Customer ID is required'));
    }

    if (!data.name?.trim()) {
      errors.push(new FieldValidationError('customer.name', 'Customer name is required'));
    }

    if (!data.address) {
      errors.push(new FieldValidationError('customer.address', 'Customer address is required'));
    }

    return errors;
  }

  validateAddressData(data: AddressData): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!data.street?.trim()) {
      errors.push(new FieldValidationError('address.street', 'Street is required'));
    }

    if (!data.city?.trim()) {
      errors.push(new FieldValidationError('address.city', 'City is required'));
    }

    if (!data.state?.trim()) {
      errors.push(new FieldValidationError('address.state', 'State is required'));
    } else {
      // Validate state code format
      const stateCode = data.state.trim().toUpperCase();
      // Check if it's a 2-letter code and validate against known states
      if (stateCode.length === 2) {
        if (!ValidationService.VALID_STATE_CODES.includes(stateCode)) {
          errors.push(new FieldValidationError('address.state', 'Invalid state code'));
        }
      } else if (stateCode.length !== 2) {
        // If it's not 2 characters, it's invalid (we only support 2-letter state codes)
        errors.push(new FieldValidationError('address.state', 'Invalid state code - must be 2-letter code'));
      }
    }

    if (!data.zip?.trim()) {
      errors.push(new FieldValidationError('address.zip', 'Zip code is required'));
    } else {
      // Validate zip code format (5 digits or 5+4 format)
      const zipRegex = /^\d{5}(-\d{4})?$/;
      if (!zipRegex.test(data.zip.trim())) {
        errors.push(new FieldValidationError('address.zip', 'Invalid zip code format'));
      }
    }

    return errors;
  }

  validateInvoiceItemData(data: InvoiceItemData): ValidationError[] {
    const errors: ValidationError[] = [];

    if (!data.description?.trim()) {
      errors.push(new FieldValidationError('item.description', 'Item description is required'));
    }

    if (data.quantity <= 0) {
      errors.push(new FieldValidationError('item.quantity', 'Quantity must be positive'));
    }

    if (data.unitPrice < 0) {
      errors.push(new FieldValidationError('item.unitPrice', 'Unit price cannot be negative'));
    }

    return errors;
  }

  validateBusinessRules(_customer: Customer, items: InvoiceItem[]): ValidationError[] {
    const errors: ValidationError[] = [];

    // Calculate subtotal
    const subtotal = items.reduce(
      (sum, item) => sum.add(item.getTotal()),
      new Money(0)
    );

    // Check minimum invoice amount
    if (subtotal.getAmount() < ValidationService.MINIMUM_INVOICE_AMOUNT) {
      errors.push(new BusinessRuleViolationError(
        'MINIMUM_INVOICE_AMOUNT',
        `Invoice amount is below minimum of $${ValidationService.MINIMUM_INVOICE_AMOUNT.toFixed(2)}`,
        'warning',
        { subtotal: subtotal.getAmount(), minimum: ValidationService.MINIMUM_INVOICE_AMOUNT }
      ));
    }

    // Check for unusually large invoices
    if (subtotal.getAmount() > ValidationService.LARGE_INVOICE_THRESHOLD) {
      errors.push(new BusinessRuleViolationError(
        'UNUSUALLY_LARGE_INVOICE',
        `Invoice amount of $${subtotal.getAmount().toFixed(2)} is unusually large`,
        'warning',
        { subtotal: subtotal.getAmount(), threshold: ValidationService.LARGE_INVOICE_THRESHOLD }
      ));
    }

    return errors;
  }

  validateCSVRow(row: CSVRow): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required fields validation
    if (!row.customer_id?.trim()) {
      errors.push(new FieldValidationError('csv.customer_id', 'Customer ID is required'));
    }

    if (!row.customer_name?.trim()) {
      errors.push(new FieldValidationError('csv.customer_name', 'Customer name is required'));
    }

    if (!row.address?.trim()) {
      errors.push(new FieldValidationError('csv.address', 'Address is required'));
    }

    if (!row.city?.trim()) {
      errors.push(new FieldValidationError('csv.city', 'City is required'));
    }

    if (!row.state?.trim()) {
      errors.push(new FieldValidationError('csv.state', 'State is required'));
    }

    if (!row.zip?.trim()) {
      errors.push(new FieldValidationError('csv.zip', 'Zip code is required'));
    }

    if (!row.amount?.trim()) {
      errors.push(new FieldValidationError('csv.amount', 'Amount is required'));
    }

    if (!row.invoice_date?.trim()) {
      errors.push(new FieldValidationError('csv.invoice_date', 'Invoice date is required'));
    }

    if (!row.due_date?.trim()) {
      errors.push(new FieldValidationError('csv.due_date', 'Due date is required'));
    }

    if (!row.items?.trim()) {
      errors.push(new FieldValidationError('csv.items', 'Items are required'));
    }

    // Format validations (only if values are present)
    if (row.amount?.trim()) {
      // Validate amount format - should be a number without $ or commas
      const amountRegex = /^-?\d+(\.\d{1,2})?$/;
      if (!amountRegex.test(row.amount.trim())) {
        errors.push(new FieldValidationError('csv.amount', 'Invalid amount format. Use numeric format without $ or commas'));
      }
    }

    if (row.invoice_date?.trim()) {
      // Validate date formats (MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY, M/D/YY)
      if (!this.isValidDateFormat(row.invoice_date.trim())) {
        errors.push(new FieldValidationError('csv.invoice_date', 'Invalid date format. Use MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY, or M/D/YY'));
      }
    }

    if (row.due_date?.trim()) {
      if (!this.isValidDateFormat(row.due_date.trim())) {
        errors.push(new FieldValidationError('csv.due_date', 'Invalid date format. Use MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY, or M/D/YY'));
      }
    }

    if (row.items?.trim()) {
      // Validate items format: item:quantity:price|item:quantity:price
      const itemsRegex = /^[^:|]+:\d+(\.\d+)?:-?\d+(\.\d{1,2})?(\|[^:|]+:\d+(\.\d+)?:-?\d+(\.\d{1,2})?)*$/;
      if (!itemsRegex.test(row.items.trim())) {
        errors.push(new FieldValidationError('csv.items', 'Invalid items format. Use format: item:quantity:price|item:quantity:price'));
      }
    }

    return errors;
  }

  private isValidDateFormat(date: string): boolean {
    // Try parsing with supported formats
    const formats = [
      /^\d{1,2}\/\d{1,2}\/\d{4}$/,     // MM/DD/YYYY or M/D/YYYY
      /^\d{4}-\d{2}-\d{2}$/,           // YYYY-MM-DD
      /^\d{1,2}-\d{1,2}-\d{4}$/,       // MM-DD-YYYY or M-D-YYYY
      /^\d{1,2}\/\d{1,2}\/\d{2}$/      // M/D/YY
    ];

    return formats.some(format => format.test(date));
  }
}