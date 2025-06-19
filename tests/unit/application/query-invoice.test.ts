/* eslint-disable @typescript-eslint/unbound-method */
 

import { QueryInvoiceUseCase } from '../../../src/application/use-cases/query-invoice.js';
import type { InvoiceRepository } from '../../../src/application/ports/invoice-repository.js';
import type { QueryInvoiceDto, QueryInvoiceByIdDto } from '../../../src/application/dto/query-invoice-dto.js';
import { Invoice } from '../../../src/domain/entities/invoice.js';
import { Customer } from '../../../src/domain/value-objects/customer.js';
import { Address } from '../../../src/domain/value-objects/address.js';
import { InvoiceItem } from '../../../src/domain/value-objects/invoice-item.js';
import { Money } from '../../../src/domain/value-objects/money.js';
import { InvoiceNotFoundError } from '../../../src/domain/exceptions/invoice-not-found-error.js';
import { InvoiceValidationError } from '../../../src/domain/exceptions/invoice-validation-error.js';

describe('QueryInvoiceUseCase', () => {
  let mockInvoiceRepository: jest.Mocked<InvoiceRepository>;
  let queryInvoiceUseCase: QueryInvoiceUseCase;

  // Helper function to create a test invoice
  const createTestInvoice = (invoiceNumber: string, customerId: string): Invoice => {
    const address = new Address('123 Main St', 'New York', 'NY', '10001');
    const customer = new Customer(customerId, 'Test Customer', address);
    const items = [
      new InvoiceItem('Test Item', 2, new Money(50.00))
    ];
    
    return new Invoice({
      invoiceNumber,
      customer,
      items,
      invoiceDate: new Date('2024-01-15'),
      dueDate: new Date('2024-02-15')
    });
  };

  beforeEach(() => {
    mockInvoiceRepository = {
      save: jest.fn(),
      findById: jest.fn(),
      findByCustomerId: jest.fn(),
      findByDateRange: jest.fn(),
      exists: jest.fn(),
    };

    queryInvoiceUseCase = new QueryInvoiceUseCase(mockInvoiceRepository);
  });

  describe('queryById', () => {
    it('should return an invoice when it exists', async () => {
      const testInvoice = createTestInvoice('INV-2024-001', 'CUST123');
      mockInvoiceRepository.findById.mockResolvedValue(testInvoice);

      const dto: QueryInvoiceByIdDto = {
        invoiceNumber: 'INV-2024-001'
      };

      const result = await queryInvoiceUseCase.queryById(dto);

      expect(result).toBeDefined();
      expect(result.invoiceNumber).toBe('INV-2024-001');
      expect(result.customerId).toBe('CUST123');
      expect(result.total).toBe(108.88); // $100 subtotal + 8.875% NY tax
      expect(mockInvoiceRepository.findById).toHaveBeenCalledWith('INV-2024-001');
    });

    it('should throw InvoiceNotFoundError when invoice does not exist', async () => {
      mockInvoiceRepository.findById.mockResolvedValue(null);

      const dto: QueryInvoiceByIdDto = {
        invoiceNumber: 'INV-NONEXISTENT'
      };

      await expect(queryInvoiceUseCase.queryById(dto)).rejects.toThrow(InvoiceNotFoundError);
      expect(mockInvoiceRepository.findById).toHaveBeenCalledWith('INV-NONEXISTENT');
    });

    it('should throw validation error for empty invoice number', async () => {
      const dto: QueryInvoiceByIdDto = {
        invoiceNumber: ''
      };

      await expect(queryInvoiceUseCase.queryById(dto)).rejects.toThrow(InvoiceValidationError);
      expect(mockInvoiceRepository.findById).not.toHaveBeenCalled();
    });
  });

  describe('query', () => {
    it('should return paginated invoices with default parameters', async () => {
      const testInvoices = [
        createTestInvoice('INV-2024-001', 'CUST123'),
        createTestInvoice('INV-2024-002', 'CUST456')
      ];

      mockInvoiceRepository.findByDateRange.mockResolvedValue({
        invoices: testInvoices,
        nextCursor: 'next-page-token'
      });

      const dto: QueryInvoiceDto = {};

      const result = await queryInvoiceUseCase.query(dto);

      expect(result.invoices).toHaveLength(2);
      expect(result.nextCursor).toBe('next-page-token');
      expect(mockInvoiceRepository.findByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        {
          limit: 20,
          cursor: undefined,
          customerId: undefined,
          status: undefined
        }
      );
    });

    it('should query by customer ID', async () => {
      const testInvoices = [
        createTestInvoice('INV-2024-001', 'CUST123'),
        createTestInvoice('INV-2024-002', 'CUST123')
      ];

      mockInvoiceRepository.findByCustomerId.mockResolvedValue({
        invoices: testInvoices,
        nextCursor: undefined
      });

      const dto: QueryInvoiceDto = {
        customerId: 'CUST123',
        limit: 10,
        sortBy: 'date',
        sortOrder: 'desc'
      };

      const result = await queryInvoiceUseCase.query(dto);

      expect(result.invoices).toHaveLength(2);
      expect(result.invoices[0].customerId).toBe('CUST123');
      expect(mockInvoiceRepository.findByCustomerId).toHaveBeenCalledWith(
        'CUST123',
        {
          limit: 10,
          cursor: undefined,
          sortBy: 'date',
          sortOrder: 'desc'
        }
      );
    });

    it('should query by date range with filters', async () => {
      const testInvoice = createTestInvoice('INV-2024-001', 'CUST123');

      mockInvoiceRepository.findByDateRange.mockResolvedValue({
        invoices: [testInvoice],
        nextCursor: undefined
      });

      const dto: QueryInvoiceDto = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        status: 'pending',
        limit: 50
      };

      const result = await queryInvoiceUseCase.query(dto);

      expect(result.invoices).toHaveLength(1);
      expect(mockInvoiceRepository.findByDateRange).toHaveBeenCalledWith(
        new Date('2024-01-01T12:00:00'),
        new Date('2024-01-31T12:00:00'),
        {
          limit: 50,
          cursor: undefined,
          customerId: undefined,
          status: 'pending'
        }
      );
    });

    it('should handle pagination with cursor', async () => {
      mockInvoiceRepository.findByDateRange.mockResolvedValue({
        invoices: [],
        nextCursor: 'page-3-token'
      });

      const dto: QueryInvoiceDto = {
        cursor: 'page-2-token',
        limit: 25
      };

      const result = await queryInvoiceUseCase.query(dto);

      expect(result.nextCursor).toBe('page-3-token');
      expect(mockInvoiceRepository.findByDateRange).toHaveBeenCalledWith(
        expect.any(Date),
        expect.any(Date),
        expect.objectContaining({
          cursor: 'page-2-token',
          limit: 25
        })
      );
    });

    it('should validate limit parameter', async () => {
      const dto: QueryInvoiceDto = {
        limit: 150 // exceeds maximum
      };

      await expect(queryInvoiceUseCase.query(dto)).rejects.toThrow(InvoiceValidationError);
      expect(mockInvoiceRepository.findByDateRange).not.toHaveBeenCalled();
    });

    it('should validate date format', async () => {
      const dto: QueryInvoiceDto = {
        startDate: 'invalid-date'
      };

      await expect(queryInvoiceUseCase.query(dto)).rejects.toThrow(InvoiceValidationError);
      expect(mockInvoiceRepository.findByDateRange).not.toHaveBeenCalled();
    });

    it('should validate date range logic', async () => {
      const dto: QueryInvoiceDto = {
        startDate: '2024-02-01',
        endDate: '2024-01-01' // end before start
      };

      await expect(queryInvoiceUseCase.query(dto)).rejects.toThrow(InvoiceValidationError);
      expect(mockInvoiceRepository.findByDateRange).not.toHaveBeenCalled();
    });

    it('should determine invoice status correctly', async () => {
      const overdueInvoice = new Invoice({
        invoiceNumber: 'INV-OVERDUE',
        customer: new Customer('CUST123', 'Test', new Address('123 Main', 'NY', 'NY', '10001')),
        items: [new InvoiceItem('Item', 1, new Money(100))],
        invoiceDate: new Date('2024-01-01'),
        dueDate: new Date('2024-01-15') // past date
      });

      mockInvoiceRepository.findByDateRange.mockResolvedValue({
        invoices: [overdueInvoice],
        nextCursor: undefined
      });

      const dto: QueryInvoiceDto = {};
      const result = await queryInvoiceUseCase.query(dto);

      expect(result.invoices[0].status).toBe('overdue');
    });

    it('should use default date range when not specified', async () => {
      mockInvoiceRepository.findByDateRange.mockResolvedValue({
        invoices: [],
        nextCursor: undefined
      });

      const dto: QueryInvoiceDto = {};
      await queryInvoiceUseCase.query(dto);

      const [[startDate, endDate]] = mockInvoiceRepository.findByDateRange.mock.calls as [[Date, Date, unknown]];
      
      // Should default to last 90 days
      const daysDiff = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDiff).toBe(90);
    });

    it('should handle repository errors gracefully', async () => {
      mockInvoiceRepository.findByDateRange.mockRejectedValue(
        new Error('Database connection failed')
      );

      const dto: QueryInvoiceDto = {};

      await expect(queryInvoiceUseCase.query(dto)).rejects.toThrow('Database connection failed');
    });
  });
});