/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { CreateInvoiceUseCase } from '../../../src/application/use-cases/create-invoice';
import type { InvoiceRepository } from '../../../src/application/ports/invoice-repository';
import type { EventPublisher } from '../../../src/application/ports/event-publisher';
import type { CreateInvoiceDto } from '../../../src/application/dto/create-invoice-dto';
import { Invoice } from '../../../src/domain/entities/invoice';
import { InvoiceValidationError } from '../../../src/domain/exceptions/invoice-validation-error';
import { CompositeValidationError } from '../../../src/domain/exceptions/validation-errors';

describe('CreateInvoiceUseCase', () => {
  let mockInvoiceRepository: jest.Mocked<InvoiceRepository>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;
  let createInvoiceUseCase: CreateInvoiceUseCase;

  beforeEach(() => {
    mockInvoiceRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCustomerId: jest.fn(),
      findByDateRange: jest.fn(),
      exists: jest.fn(),
    };

    mockEventPublisher = {
      publish: jest.fn(),
    };

    createInvoiceUseCase = new CreateInvoiceUseCase(
      mockInvoiceRepository,
      mockEventPublisher
    );
  });

  describe('execute', () => {
    it('should create and save a valid invoice', async () => {
      const createInvoiceDto: CreateInvoiceDto = {
        invoiceNumber: 'INV-2024-001',
        customerId: 'CUST123',
        customerName: 'Acme Corp',
        customerAddress: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zip: '10001',
        },
        invoiceDate: '2024-01-15',
        dueDate: '2024-02-15',
        items: [
          {
            description: 'Product A',
            quantity: 10,
            unitPrice: 100.0,
          },
          {
            description: 'Product B',
            quantity: 5,
            unitPrice: 50.0,
          },
        ],
      };

      mockInvoiceRepository.save.mockResolvedValue(undefined);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      const result = await createInvoiceUseCase.execute(createInvoiceDto);

      expect(result).toBeInstanceOf(Invoice);
      expect(result.invoiceNumber).toBe('INV-2024-001');
      expect(result.customer.id).toBe('CUST123');
      expect(result.customer.name).toBe('Acme Corp');
      expect(result.items).toHaveLength(2);
      expect(result.subtotal.getAmount()).toBe(1250.0);
      expect(mockInvoiceRepository.save).toHaveBeenCalledWith(result);
      expect(mockEventPublisher.publish).toHaveBeenCalledWith({
        eventType: 'InvoiceCreated',
        invoiceId: result.invoiceNumber,
        customerId: result.customer.getId(),
        total: result.total.getAmount(),
        dueDate: result.dueDate.toISOString(),
        timestamp: expect.any(Date),
      });
    });

    it('should apply bulk discount for orders >= $10,000', async () => {
      const createInvoiceDto: CreateInvoiceDto = {
        invoiceNumber: 'INV-2024-002',
        customerId: 'CUST456',
        customerName: 'Big Corp',
        customerAddress: {
          street: '456 Broadway',
          city: 'New York',
          state: 'NY',
          zip: '10002',
        },
        invoiceDate: '2024-01-15',
        dueDate: '2024-02-15',
        items: [
          {
            description: 'Bulk Order',
            quantity: 100,
            unitPrice: 110.0,
          },
        ],
      };

      const result = await createInvoiceUseCase.execute(createInvoiceDto);

      expect(result.subtotal.getAmount()).toBe(11000.0);
      expect(result.bulkDiscount.getAmount()).toBe(330.0); // 3% of 11000
    });

    it('should apply Q4 tax adjustment for October-December invoices', async () => {
      const createInvoiceDto: CreateInvoiceDto = {
        invoiceNumber: 'INV-2024-Q4',
        customerId: 'CUST789',
        customerName: 'Q4 Corp',
        customerAddress: {
          street: '789 Wall St',
          city: 'New York',
          state: 'NY',
          zip: '10003',
        },
        invoiceDate: '2024-11-15', // November (Q4)
        dueDate: '2024-12-15',
        items: [
          {
            description: 'Q4 Product',
            quantity: 10,
            unitPrice: 100.0,
          },
        ],
      };

      const result = await createInvoiceUseCase.execute(createInvoiceDto);

      // NY state tax is 8.875% + 2% Q4 adjustment = 10.875%
      const expectedTax = 1000.0 * 0.10875;
      expect(result.tax.getAmount()).toBe(Number(expectedTax.toFixed(2)));
    });

    it('should handle tax-exempt customers', async () => {
      const createInvoiceDto: CreateInvoiceDto = {
        invoiceNumber: 'INV-2024-EXEMPT',
        customerId: 'CUST001', // Tax-exempt customer
        customerName: 'Tax Exempt Corp',
        customerAddress: {
          street: '100 Exempt Ave',
          city: 'New York',
          state: 'NY',
          zip: '10004',
        },
        invoiceDate: '2024-01-15',
        dueDate: '2024-02-15',
        items: [
          {
            description: 'Exempt Product',
            quantity: 10,
            unitPrice: 100.0,
          },
        ],
      };

      const result = await createInvoiceUseCase.execute(createInvoiceDto);

      expect(result.tax.getAmount()).toBe(0);
    });

    it('should reject invoices below minimum amount', async () => {
      const createInvoiceDto: CreateInvoiceDto = {
        invoiceNumber: 'INV-2024-SMALL',
        customerId: 'CUST999',
        customerName: 'Small Corp',
        customerAddress: {
          street: '999 Small St',
          city: 'New York',
          state: 'NY',
          zip: '10005',
        },
        invoiceDate: '2024-01-15',
        dueDate: '2024-02-15',
        items: [
          {
            description: 'Small Item',
            quantity: 1,
            unitPrice: 10.0,
          },
        ],
      };

      await expect(createInvoiceUseCase.execute(createInvoiceDto)).rejects.toThrow(
        CompositeValidationError
      );
    });

    it('should validate all fields and collect errors', async () => {
      const createInvoiceDto: CreateInvoiceDto = {
        invoiceNumber: '', // Invalid
        customerId: '', // Invalid
        customerName: '', // Invalid
        customerAddress: {
          street: '',
          city: '',
          state: 'INVALID', // Invalid state
          zip: '123', // Invalid zip
        },
        invoiceDate: 'invalid-date', // Invalid
        dueDate: '2024-01-01', // Before invoice date
        items: [], // No items
      };

      await expect(createInvoiceUseCase.execute(createInvoiceDto)).rejects.toThrow(
        CompositeValidationError
      );
    });

    it('should check for duplicate invoice numbers', async () => {
      const createInvoiceDto: CreateInvoiceDto = {
        invoiceNumber: 'INV-DUPLICATE',
        customerId: 'CUST123',
        customerName: 'Duplicate Corp',
        customerAddress: {
          street: '123 Dup St',
          city: 'New York',
          state: 'NY',
          zip: '10001',
        },
        invoiceDate: '2024-01-15',
        dueDate: '2024-02-15',
        items: [
          {
            description: 'Product',
            quantity: 10,
            unitPrice: 100.0,
          },
        ],
      };

      mockInvoiceRepository.exists.mockResolvedValue(true);

      await expect(createInvoiceUseCase.execute(createInvoiceDto)).rejects.toThrow(
        InvoiceValidationError
      );
      expect(mockInvoiceRepository.exists).toHaveBeenCalledWith('INV-DUPLICATE');
    });

    it('should handle repository errors gracefully', async () => {
      const createInvoiceDto: CreateInvoiceDto = {
        invoiceNumber: 'INV-2024-ERROR',
        customerId: 'CUST123',
        customerName: 'Error Corp',
        customerAddress: {
          street: '123 Error St',
          city: 'New York',
          state: 'NY',
          zip: '10001',
        },
        invoiceDate: '2024-01-15',
        dueDate: '2024-02-15',
        items: [
          {
            description: 'Product',
            quantity: 10,
            unitPrice: 100.0,
          },
        ],
      };

      mockInvoiceRepository.save.mockRejectedValue(new Error('Database error'));

      await expect(createInvoiceUseCase.execute(createInvoiceDto)).rejects.toThrow(
        'Database error'
      );
    });

    it('should continue processing even if event publishing fails', async () => {
      const createInvoiceDto: CreateInvoiceDto = {
        invoiceNumber: 'INV-2024-EVENT-FAIL',
        customerId: 'CUST123',
        customerName: 'Event Fail Corp',
        customerAddress: {
          street: '123 Event St',
          city: 'New York',
          state: 'NY',
          zip: '10001',
        },
        invoiceDate: '2024-01-15',
        dueDate: '2024-02-15',
        items: [
          {
            description: 'Product',
            quantity: 10,
            unitPrice: 100.0,
          },
        ],
      };

      mockEventPublisher.publish.mockRejectedValue(new Error('Event bus error'));

      const result = await createInvoiceUseCase.execute(createInvoiceDto);

      expect(result).toBeInstanceOf(Invoice);
      expect(mockInvoiceRepository.save).toHaveBeenCalled();
      // Should not throw even though event publishing failed
    });

    it('should handle items with various decimal precisions', async () => {
      const createInvoiceDto: CreateInvoiceDto = {
        invoiceNumber: 'INV-2024-DECIMALS',
        customerId: 'CUST123',
        customerName: 'Decimal Corp',
        customerAddress: {
          street: '123 Decimal St',
          city: 'New York',
          state: 'NY',
          zip: '10001',
        },
        invoiceDate: '2024-01-15',
        dueDate: '2024-02-15',
        items: [
          {
            description: 'Item with 3 decimals',
            quantity: 3.333,
            unitPrice: 33.333,
          },
          {
            description: 'Item with 1 decimal',
            quantity: 5.5,
            unitPrice: 10.1,
          },
        ],
      };

      const result = await createInvoiceUseCase.execute(createInvoiceDto);

      // Verify proper rounding to 2 decimal places
      expect(result.items[0].getTotal().getAmount()).toBe(111.09); // 3.333 * 33.333 = 111.08889 -> 111.09
      expect(result.items[1].getTotal().getAmount()).toBe(55.55); // 5.5 * 10.1 = 55.55
      expect(result.subtotal.getAmount()).toBe(166.64); // 111.09 + 55.55 = 166.64
    });
  });
});