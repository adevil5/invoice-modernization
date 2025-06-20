import { Invoice } from '@domain/entities/invoice';
import { Address } from '@domain/value-objects/address';
import { Customer } from '@domain/value-objects/customer';
import { InvoiceItem } from '@domain/value-objects/invoice-item';
import { Money } from '@domain/value-objects/money';
import { InvoiceValidationError } from '@domain/exceptions/invoice-validation-error';

describe('Invoice Entity', () => {
  const validCustomer = new Customer(
    'CUST123',
    'Acme Corporation',
    new Address('123 Main St', 'San Francisco', 'CA', '94102')
  );

  const validItems = [
    new InvoiceItem('Widget', 5, new Money(10.00)),
    new InvoiceItem('Gadget', 2, new Money(25.00))
  ];

  const validInvoiceData = {
    invoiceNumber: 'INV-TEST-001',
    customer: validCustomer,
    items: validItems,
    invoiceDate: new Date('2024-01-15'),
    dueDate: new Date('2024-02-15')
  };

  describe('Invoice Creation', () => {
    it('should create a valid invoice with required fields', () => {
      const invoice = new Invoice(validInvoiceData);

      expect(invoice.getCustomer()).toEqual(validCustomer);
      expect(invoice.getItems()).toEqual(validItems);
      expect(invoice.getInvoiceDate()).toEqual(new Date('2024-01-15'));
      expect(invoice.getDueDate()).toEqual(new Date('2024-02-15'));
      expect(invoice.getId()).toBeDefined();
      expect(invoice.getCreatedAt()).toBeDefined();
    });

    it('should generate a unique invoice ID', () => {
      const invoice1 = new Invoice({
        ...validInvoiceData,
        invoiceNumber: 'INV-TEST-002'
      });
      const invoice2 = new Invoice({
        ...validInvoiceData,
        invoiceNumber: 'INV-TEST-003'
      });

      expect(invoice1.getId()).not.toEqual(invoice2.getId());
    });

    it('should calculate subtotal correctly', () => {
      const invoice = new Invoice(validInvoiceData);
      // 5 * 10 + 2 * 25 = 50 + 50 = 100
      expect(invoice.getSubtotal().getAmount()).toBe(100.00);
    });

    it('should apply minimum invoice amount of $25', () => {
      const smallItems = [new InvoiceItem('Small Item', 1, new Money(10.00))];
      const invoice = new Invoice({
        ...validInvoiceData,
        items: smallItems
      });

      expect(invoice.getSubtotal().getAmount()).toBe(25.00);
    });
  });

  describe('Validation', () => {
    it('should throw error if customer is missing', () => {
      expect(() => {
        new Invoice({
          ...validInvoiceData,
          customer: null as unknown as Customer
        });
      }).toThrow(InvoiceValidationError);
    });

    it('should throw error if items array is empty', () => {
      expect(() => {
        new Invoice({
          ...validInvoiceData,
          items: []
        });
      }).toThrow(InvoiceValidationError);
    });

    it('should throw error if invoice date is missing', () => {
      expect(() => {
        new Invoice({
          ...validInvoiceData,
          invoiceDate: null as unknown as Date
        });
      }).toThrow(InvoiceValidationError);
    });

    it('should throw error if due date is missing', () => {
      expect(() => {
        new Invoice({
          ...validInvoiceData,
          dueDate: null as unknown as Date
        });
      }).toThrow(InvoiceValidationError);
    });

    it('should throw error if due date is before invoice date', () => {
      expect(() => {
        new Invoice({
          ...validInvoiceData,
          invoiceDate: new Date('2024-02-15'),
          dueDate: new Date('2024-01-15')
        });
      }).toThrow(InvoiceValidationError);
    });

    it('should throw error for negative amounts', () => {
      // Money constructor will throw error for negative amounts
      expect(() => {
        new InvoiceItem('Bad Item', 1, new Money(-10.00));
      }).toThrow('Money amount cannot be negative');
    });
  });

  describe('Tax Calculation', () => {
    it('should calculate tax based on state rate', () => {
      const invoice = new Invoice(validInvoiceData);
      // CA tax rate is 7.25%
      const tax = invoice.calculateTax();
      expect(tax.getAmount()).toBe(7.25); // 100 * 0.0725
    });

    it('should apply Q4 tax adjustment', () => {
      const q4Invoice = new Invoice({
        ...validInvoiceData,
        invoiceDate: new Date('2024-11-15'), // Q4
        dueDate: new Date('2024-12-15')
      });
      // CA tax rate 7.25% + 2% Q4 adjustment = 9.25%
      const tax = q4Invoice.calculateTax();
      expect(tax.getAmount()).toBe(9.25); // 100 * 0.0925
    });

    it('should apply customer tax override', () => {
      const taxExemptCustomer = new Customer(
        'CUST001', // Tax exempt customer from legacy analysis
        'Nonprofit Org',
        new Address('456 Oak St', 'San Francisco', 'CA', '94102')
      );
      
      const invoice = new Invoice({
        ...validInvoiceData,
        customer: taxExemptCustomer
      });
      
      const tax = invoice.calculateTax();
      expect(tax.getAmount()).toBe(0);
    });

    it('should use default tax rate for unknown states', () => {
      const unknownStateCustomer = new Customer(
        'CUST999',
        'Unknown State Corp',
        new Address('789 Pine St', 'Unknown City', 'XX', '99999')
      );
      
      const invoice = new Invoice({
        ...validInvoiceData,
        customer: unknownStateCustomer
      });
      
      // Default tax rate is 5%
      const tax = invoice.calculateTax();
      expect(tax.getAmount()).toBe(5.00); // 100 * 0.05
    });
  });

  describe('Bulk Discount', () => {
    it('should apply 3% bulk discount for orders >= $10,000', () => {
      const bulkItems = [new InvoiceItem('Bulk Item', 1000, new Money(10.00))];
      const invoice = new Invoice({
        ...validInvoiceData,
        items: bulkItems
      });

      // Subtotal: 10,000, Discount: 300 (3%)
      expect(invoice.getSubtotal().getAmount()).toBe(10000.00);
      expect(invoice.getBulkDiscount().getAmount()).toBe(300.00);
      
      // Tax should be calculated on discounted amount
      const tax = invoice.calculateTax();
      expect(tax.getAmount()).toBe(703.25); // (10000 - 300) * 0.0725
    });

    it('should not apply bulk discount for orders < $10,000', () => {
      const smallBulkItems = [new InvoiceItem('Item', 999, new Money(10.00))];
      const invoice = new Invoice({
        ...validInvoiceData,
        items: smallBulkItems
      });

      expect(invoice.getSubtotal().getAmount()).toBe(9990.00);
      expect(invoice.getBulkDiscount().getAmount()).toBe(0);
    });
  });

  describe('Late Fees', () => {
    it('should calculate late fees for overdue invoices', () => {
      const overdueInvoice = new Invoice({
        ...validInvoiceData,
        invoiceDate: new Date('2024-01-15'),
        dueDate: new Date('2024-02-15')
      });

      // Simulate checking 35 days after due date (1 month late)
      const checkDate = new Date('2024-03-22');
      const lateFee = overdueInvoice.calculateLateFee(checkDate);
      
      // Total: 100 + 7.25 tax = 107.25
      // Late fee: 107.25 * 0.015 * 1 month = 1.61
      expect(lateFee.getAmount()).toBe(1.61);
    });

    it('should not charge late fees before 30 days past due', () => {
      const invoice = new Invoice(validInvoiceData);
      
      // Check 29 days after due date
      const checkDate = new Date('2024-03-15'); // Due date + 29 days
      const lateFee = invoice.calculateLateFee(checkDate);
      
      expect(lateFee.getAmount()).toBe(0);
    });

    it('should calculate multiple months of late fees', () => {
      const overdueInvoice = new Invoice({
        ...validInvoiceData,
        invoiceDate: new Date('2024-01-15'),
        dueDate: new Date('2024-02-15')
      });

      // 65 days late = 2 months
      const checkDate = new Date('2024-04-21');
      const lateFee = overdueInvoice.calculateLateFee(checkDate);
      
      // Total: 107.25, Late fee: 107.25 * 0.015 * 2 = 3.22
      expect(lateFee.getAmount()).toBe(3.22);
    });
  });

  describe('Total Calculation', () => {
    it('should calculate total correctly with all components', () => {
      const invoice = new Invoice(validInvoiceData);
      
      // Subtotal: 100, Tax: 7.25, Total: 107.25
      expect(invoice.getTotal().getAmount()).toBe(107.25);
    });

    it('should include bulk discount in total calculation', () => {
      const bulkItems = [new InvoiceItem('Bulk Item', 1000, new Money(10.00))];
      const invoice = new Invoice({
        ...validInvoiceData,
        items: bulkItems
      });

      // Subtotal: 10000, Discount: 300, Tax on 9700: 703.25, Total: 10403.25
      expect(invoice.getTotal().getAmount()).toBe(10403.25);
    });
  });

  describe('Immutability', () => {
    it('should not allow modification of customer after creation', () => {
      const invoice = new Invoice(validInvoiceData);
      const originalCustomer = invoice.getCustomer();
      
      // There should be no setter method
      expect((invoice as Record<string, unknown>).setCustomer).toBeUndefined();
      expect(invoice.getCustomer()).toEqual(originalCustomer);
    });

    it('should return defensive copy of items array', () => {
      const invoice = new Invoice(validInvoiceData);
      const items = invoice.getItems();
      
      // Modifying returned array should not affect invoice
      items.push(new InvoiceItem('Extra', 1, new Money(100)));
      
      expect(invoice.getItems().length).toBe(2);
    });

    it('should not allow modification of dates after creation', () => {
      const invoice = new Invoice(validInvoiceData);
      const invoiceDate = invoice.getInvoiceDate();
      
      // Modifying returned date should not affect invoice
      invoiceDate.setFullYear(2025);
      
      expect(invoice.getInvoiceDate().getFullYear()).toBe(2024);
    });
  });
});