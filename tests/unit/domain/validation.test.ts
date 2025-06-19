import { describe, it, expect } from '@jest/globals';
import { ValidationService } from '../../../src/domain/services/validation-service.js';
import { FieldValidationError, BusinessRuleViolationError } from '../../../src/domain/exceptions/validation-errors.js';
import { Customer } from '../../../src/domain/value-objects/customer.js';
import { Address } from '../../../src/domain/value-objects/address.js';
import { InvoiceItem } from '../../../src/domain/value-objects/invoice-item.js';
import { Money } from '../../../src/domain/value-objects/money.js';

describe('ValidationService', () => {
  describe('validateInvoiceData', () => {
    const validCustomer = new Customer(
      'CUST123',
      'Test Customer',
      new Address('123 Main St', 'Test City', 'CA', '12345')
    );

    const validItem = new InvoiceItem(
      'Test Item',
      1,
      new Money(100)
    );

    const validInvoiceData = {
      customer: validCustomer,
      items: [validItem],
      invoiceDate: new Date('2024-01-15'),
      dueDate: new Date('2024-02-15')
    };

    it('should validate correct invoice data without errors', () => {
      const service = new ValidationService();
      const errors = service.validateInvoiceData(validInvoiceData);
      
      expect(errors).toHaveLength(0);
    });

    it('should return error when customer is missing', () => {
      const service = new ValidationService();
      const invalidData = { ...validInvoiceData, customer: null };
      
      const errors = service.validateInvoiceData(invalidData);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FieldValidationError);
      expect((errors[0] as FieldValidationError).field).toBe('customer');
      expect(errors[0].message).toContain('Customer is required');
    });

    it('should return error when items array is empty', () => {
      const service = new ValidationService();
      const invalidData = { ...validInvoiceData, items: [] };
      
      const errors = service.validateInvoiceData(invalidData);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FieldValidationError);
      expect((errors[0] as FieldValidationError).field).toBe('items');
      expect(errors[0].message).toContain('At least one item is required');
    });

    it('should return error when invoice date is missing', () => {
      const service = new ValidationService();
      const invalidData = { ...validInvoiceData, invoiceDate: null };
      
      const errors = service.validateInvoiceData(invalidData);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FieldValidationError);
      expect((errors[0] as FieldValidationError).field).toBe('invoiceDate');
      expect(errors[0].message).toContain('Invoice date is required');
    });

    it('should return error when due date is missing', () => {
      const service = new ValidationService();
      const invalidData = { ...validInvoiceData, dueDate: null };
      
      const errors = service.validateInvoiceData(invalidData);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FieldValidationError);
      expect((errors[0] as FieldValidationError).field).toBe('dueDate');
      expect(errors[0].message).toContain('Due date is required');
    });

    it('should return error when due date is before invoice date', () => {
      const service = new ValidationService();
      const invalidData = {
        ...validInvoiceData,
        invoiceDate: new Date('2024-02-15'),
        dueDate: new Date('2024-01-15')
      };
      
      const errors = service.validateInvoiceData(invalidData);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(BusinessRuleViolationError);
      expect((errors[0] as BusinessRuleViolationError).rule).toBe('DUE_DATE_BEFORE_INVOICE_DATE');
      expect(errors[0].message).toContain('Due date cannot be before invoice date');
    });

    it('should return multiple errors when multiple fields are invalid', () => {
      const service = new ValidationService();
      const invalidData = {
        customer: null,
        items: [],
        invoiceDate: null,
        dueDate: null
      };
      
      const errors = service.validateInvoiceData(invalidData);
      
      expect(errors).toHaveLength(4);
      expect(errors.map(e => (e as FieldValidationError).field)).toEqual([
        'customer',
        'items',
        'invoiceDate',
        'dueDate'
      ]);
    });
  });

  describe('validateCustomerData', () => {
    it('should validate correct customer data', () => {
      const service = new ValidationService();
      const errors = service.validateCustomerData({
        id: 'CUST123',
        name: 'Test Customer',
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'CA',
          zip: '12345'
        }
      });
      
      expect(errors).toHaveLength(0);
    });

    it('should return error for empty customer ID', () => {
      const service = new ValidationService();
      const errors = service.validateCustomerData({
        id: '   ',
        name: 'Test Customer',
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'CA',
          zip: '12345'
        }
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FieldValidationError);
      expect((errors[0] as FieldValidationError).field).toBe('customer.id');
    });

    it('should return error for empty customer name', () => {
      const service = new ValidationService();
      const errors = service.validateCustomerData({
        id: 'CUST123',
        name: '',
        address: {
          street: '123 Main St',
          city: 'Test City',
          state: 'CA',
          zip: '12345'
        }
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FieldValidationError);
      expect((errors[0] as FieldValidationError).field).toBe('customer.name');
    });

    it('should return error for missing address', () => {
      const service = new ValidationService();
      const errors = service.validateCustomerData({
        id: 'CUST123',
        name: 'Test Customer',
        address: null
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FieldValidationError);
      expect((errors[0] as FieldValidationError).field).toBe('customer.address');
    });
  });

  describe('validateAddressData', () => {
    it('should validate correct address data', () => {
      const service = new ValidationService();
      const errors = service.validateAddressData({
        street: '123 Main St',
        city: 'Test City',
        state: 'CA',
        zip: '12345'
      });
      
      expect(errors).toHaveLength(0);
    });

    it('should return errors for empty address fields', () => {
      const service = new ValidationService();
      const errors = service.validateAddressData({
        street: '  ',
        city: '',
        state: '   ',
        zip: ''
      });
      
      expect(errors).toHaveLength(4);
      expect(errors.map(e => (e as FieldValidationError).field)).toEqual([
        'address.street',
        'address.city',
        'address.state',
        'address.zip'
      ]);
    });

    it('should validate state code format', () => {
      const service = new ValidationService();
      const errors = service.validateAddressData({
        street: '123 Main St',
        city: 'Test City',
        state: 'ABC', // Invalid state code
        zip: '12345'
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FieldValidationError);
      expect((errors[0] as FieldValidationError).field).toBe('address.state');
      expect(errors[0].message).toContain('Invalid state code');
    });

    it('should validate zip code format', () => {
      const service = new ValidationService();
      const errors = service.validateAddressData({
        street: '123 Main St',
        city: 'Test City',
        state: 'CA',
        zip: '123' // Too short
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FieldValidationError);
      expect((errors[0] as FieldValidationError).field).toBe('address.zip');
      expect(errors[0].message).toContain('Invalid zip code format');
    });
  });

  describe('validateInvoiceItemData', () => {
    it('should validate correct item data', () => {
      const service = new ValidationService();
      const errors = service.validateInvoiceItemData({
        description: 'Test Item',
        quantity: 1,
        unitPrice: 100
      });
      
      expect(errors).toHaveLength(0);
    });

    it('should return error for empty description', () => {
      const service = new ValidationService();
      const errors = service.validateInvoiceItemData({
        description: '   ',
        quantity: 1,
        unitPrice: 100
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FieldValidationError);
      expect((errors[0] as FieldValidationError).field).toBe('item.description');
    });

    it('should return error for zero quantity', () => {
      const service = new ValidationService();
      const errors = service.validateInvoiceItemData({
        description: 'Test Item',
        quantity: 0,
        unitPrice: 100
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FieldValidationError);
      expect((errors[0] as FieldValidationError).field).toBe('item.quantity');
      expect(errors[0].message).toContain('Quantity must be positive');
    });

    it('should return error for negative quantity', () => {
      const service = new ValidationService();
      const errors = service.validateInvoiceItemData({
        description: 'Test Item',
        quantity: -5,
        unitPrice: 100
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FieldValidationError);
      expect((errors[0] as FieldValidationError).field).toBe('item.quantity');
    });

    it('should return error for negative unit price', () => {
      const service = new ValidationService();
      const errors = service.validateInvoiceItemData({
        description: 'Test Item',
        quantity: 1,
        unitPrice: -50
      });
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(FieldValidationError);
      expect((errors[0] as FieldValidationError).field).toBe('item.unitPrice');
      expect(errors[0].message).toContain('Unit price cannot be negative');
    });
  });

  describe('validateBusinessRules', () => {
    const validCustomer = new Customer(
      'CUST123',
      'Test Customer',
      new Address('123 Main St', 'Test City', 'CA', '12345')
    );

    it('should not return error for invoice above minimum amount', () => {
      const service = new ValidationService();
      const items = [
        new InvoiceItem(
          'Test Item',
          1,
          new Money(50) // Above $25 minimum
        )
      ];
      
      const errors = service.validateBusinessRules(validCustomer, items);
      
      expect(errors).toHaveLength(0);
    });

    it('should return warning for invoice below minimum amount', () => {
      const service = new ValidationService();
      const items = [
        new InvoiceItem(
          'Test Item',
          1,
          new Money(10) // Below $25 minimum
        )
      ];
      
      const errors = service.validateBusinessRules(validCustomer, items);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(BusinessRuleViolationError);
      expect((errors[0] as BusinessRuleViolationError).rule).toBe('MINIMUM_INVOICE_AMOUNT');
      expect((errors[0] as BusinessRuleViolationError).severity).toBe('error');
      expect(errors[0].message).toContain('Invoice amount is below minimum of $25.00');
    });

    it('should validate large invoices for potential issues', () => {
      const service = new ValidationService();
      const items = [
        new InvoiceItem(
          'Large Order',
          1000,
          new Money(1000) // $1,000,000 total
        )
      ];
      
      const errors = service.validateBusinessRules(validCustomer, items);
      
      expect(errors).toHaveLength(1);
      expect(errors[0]).toBeInstanceOf(BusinessRuleViolationError);
      expect((errors[0] as BusinessRuleViolationError).rule).toBe('UNUSUALLY_LARGE_INVOICE');
      expect((errors[0] as BusinessRuleViolationError).severity).toBe('warning');
    });
  });

  describe('validateCSVRow', () => {
    it('should validate correct CSV row', () => {
      const service = new ValidationService();
      const row = {
        customer_id: 'CUST123',
        customer_name: 'Test Customer',
        address: '123 Main St',
        city: 'Test City',
        state: 'CA',
        zip: '12345',
        amount: '100.00',
        invoice_date: '01/15/2024',
        due_date: '02/15/2024',
        items: 'Item 1:1:100'
      };
      
      const errors = service.validateCSVRow(row);
      
      expect(errors).toHaveLength(0);
    });

    it('should return error for missing required fields', () => {
      const service = new ValidationService();
      const row = {
        customer_id: '',
        customer_name: 'Test Customer',
        address: '123 Main St'
        // Missing other required fields
      };
      
      const errors = service.validateCSVRow(row);
      
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some(e => (e as FieldValidationError).field === 'csv.customer_id')).toBe(true);
    });

    it('should validate amount format', () => {
      const service = new ValidationService();
      const row = {
        customer_id: 'CUST123',
        customer_name: 'Test Customer',
        address: '123 Main St',
        city: 'Test City',
        state: 'CA',
        zip: '12345',
        amount: '$1,234.56', // Invalid format with $ and comma
        invoice_date: '01/15/2024',
        due_date: '02/15/2024',
        items: 'Item 1:1:100'
      };
      
      const errors = service.validateCSVRow(row);
      
      expect(errors).toHaveLength(1);
      expect((errors[0] as FieldValidationError).field).toBe('csv.amount');
      expect(errors[0].message).toContain('Invalid amount format');
    });

    it('should validate date formats', () => {
      const service = new ValidationService();
      const row = {
        customer_id: 'CUST123',
        customer_name: 'Test Customer',
        address: '123 Main St',
        city: 'Test City',
        state: 'CA',
        zip: '12345',
        amount: '100.00',
        invoice_date: 'Jan 15, 2024', // Invalid format
        due_date: '02/15/2024',
        items: 'Item 1:1:100'
      };
      
      const errors = service.validateCSVRow(row);
      
      expect(errors).toHaveLength(1);
      expect((errors[0] as FieldValidationError).field).toBe('csv.invoice_date');
      expect(errors[0].message).toContain('Invalid date format');
    });

    it('should validate items format', () => {
      const service = new ValidationService();
      const row = {
        customer_id: 'CUST123',
        customer_name: 'Test Customer',
        address: '123 Main St',
        city: 'Test City',
        state: 'CA',
        zip: '12345',
        amount: '100.00',
        invoice_date: '01/15/2024',
        due_date: '02/15/2024',
        items: 'Item 1,1,100' // Wrong delimiters
      };
      
      const errors = service.validateCSVRow(row);
      
      expect(errors).toHaveLength(1);
      expect((errors[0] as FieldValidationError).field).toBe('csv.items');
      expect(errors[0].message).toContain('Invalid items format');
    });
  });
});