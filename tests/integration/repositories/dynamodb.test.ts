import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { DynamoDBInvoiceRepository } from '@infrastructure/repositories/dynamodb-invoice-repository';
import { Invoice } from '@domain/entities/invoice';
import { Customer } from '@domain/value-objects/customer';
import { Address } from '@domain/value-objects/address';
import { InvoiceItem } from '@domain/value-objects/invoice-item';
import { Money } from '@domain/value-objects/money';
import type { FindOptions, DateRangeOptions } from '@application/ports/invoice-repository';

describe('DynamoDBInvoiceRepository Integration', () => {
  let repository: DynamoDBInvoiceRepository;
  let dynamoClient: DynamoDBClient;
  let docClient: DynamoDBDocumentClient;
  const tableName = 'test-invoices';

  // Test data factory
  const createTestInvoice = (overrides?: Partial<any>): Invoice => {
    const defaultData = {
      invoiceNumber: `INV-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      customer: new Customer(
        'CUST123',
        'Test Company',
        new Address(
          '123 Main St',
          'San Francisco',
          'CA',
          '94105'
        )
      ),
      items: [
        new InvoiceItem(
          'Test Item 1',
          2,
          new Money(50.00)
        ),
        new InvoiceItem(
          'Test Item 2',
          1,
          new Money(100.00)
        )
      ],
      invoiceDate: new Date('2024-01-15'),
      dueDate: new Date('2024-02-14'),
      ...overrides
    };
    return new Invoice(defaultData);
  };

  beforeAll(() => {
    // Setup DynamoDB client for local testing
    // In CI/CD, this could point to LocalStack or DynamoDB Local
    dynamoClient = new DynamoDBClient({
      endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: 'test',
        secretAccessKey: 'test'
      }
    });
    docClient = DynamoDBDocumentClient.from(dynamoClient);
    repository = new DynamoDBInvoiceRepository(docClient, tableName);
  });

  beforeEach(async () => {
    // Clear test data - in a real setup, we'd create/destroy test tables
    // For now, we'll skip this and assume LocalStack or test setup handles it
  });

  afterAll(() => {
    dynamoClient.destroy();
  });

  describe('save', () => {
    it('should save an invoice successfully', async () => {
      const invoice = createTestInvoice();
      
      await expect(repository.save(invoice)).resolves.not.toThrow();
      
      // Verify it was saved by retrieving it
      const saved = await repository.findById(invoice.invoiceNumber);
      expect(saved).not.toBeNull();
      expect(saved?.invoiceNumber).toBe(invoice.invoiceNumber);
    });

    it('should preserve all invoice fields when saving', async () => {
      const invoice = createTestInvoice();
      
      await repository.save(invoice);
      const saved = await repository.findById(invoice.invoiceNumber);
      
      expect(saved).not.toBeNull();
      expect(saved?.customer.getId()).toBe(invoice.customer.getId());
      expect(saved?.customer.getName()).toBe(invoice.customer.getName());
      expect(saved?.items).toHaveLength(invoice.items.length);
      expect(saved?.subtotal.getAmount()).toBe(invoice.subtotal.getAmount());
      expect(saved?.tax.getAmount()).toBe(invoice.tax.getAmount());
      expect(saved?.total.getAmount()).toBe(invoice.total.getAmount());
      expect(saved?.invoiceDate).toEqual(invoice.invoiceDate);
      expect(saved?.dueDate).toEqual(invoice.dueDate);
    });

    it('should handle concurrent saves without data loss', async () => {
      const invoices = Array.from({ length: 5 }, () => createTestInvoice());
      
      await Promise.all(invoices.map(inv => repository.save(inv)));
      
      const results = await Promise.all(
        invoices.map(inv => repository.findById(inv.invoiceNumber))
      );
      
      expect(results.every(result => result !== null)).toBe(true);
    });
  });

  describe('findById', () => {
    it('should return null for non-existent invoice', async () => {
      const result = await repository.findById('NON-EXISTENT-ID');
      expect(result).toBeNull();
    });

    it('should return the correct invoice when found', async () => {
      const invoice = createTestInvoice();
      await repository.save(invoice);
      
      const found = await repository.findById(invoice.invoiceNumber);
      
      expect(found).not.toBeNull();
      expect(found?.invoiceNumber).toBe(invoice.invoiceNumber);
      expect(found?.getId()).toBe(invoice.getId());
    });
  });

  describe('findByCustomerId', () => {
    beforeEach(async () => {
      // Create test invoices for different customers
      const customer1Invoices = Array.from({ length: 3 }, (_, i) => 
        createTestInvoice({
          customer: new Customer(
            'CUST001',
            'Customer 1',
            new Address(
              '123 Main St',
              'San Francisco',
              'CA',
              '94105'
            )
          ),
          invoiceDate: new Date(2024, 0, i + 1)
        })
      );
      
      const customer2Invoices = Array.from({ length: 2 }, (_, i) => 
        createTestInvoice({
          customer: new Customer(
            'CUST002',
            'Customer 2',
            new Address(
              '456 Oak St',
              'San Francisco',
              'CA',
              '94105'
            )
          ),
          invoiceDate: new Date(2024, 0, i + 10)
        })
      );
      
      await Promise.all([
        ...customer1Invoices.map(inv => repository.save(inv)),
        ...customer2Invoices.map(inv => repository.save(inv))
      ]);
    });

    it('should return invoices for specific customer', async () => {
      const result = await repository.findByCustomerId('CUST001');
      
      expect(result.invoices).toHaveLength(3);
      expect(result.invoices.every((inv: Invoice) => inv.customer.getId() === 'CUST001')).toBe(true);
    });

    it('should support pagination with limit', async () => {
      const options: FindOptions = { limit: 2 };
      const result = await repository.findByCustomerId('CUST001', options);
      
      expect(result.invoices).toHaveLength(2);
      expect(result.nextCursor).toBeDefined();
    });

    it('should support pagination with cursor', async () => {
      // First page
      const firstPage = await repository.findByCustomerId('CUST001', { limit: 2 });
      expect(firstPage.invoices).toHaveLength(2);
      expect(firstPage.nextCursor).toBeDefined();
      
      // Second page
      const secondPage = await repository.findByCustomerId('CUST001', {
        limit: 2,
        cursor: firstPage.nextCursor
      });
      expect(secondPage.invoices).toHaveLength(1);
      expect(secondPage.nextCursor).toBeUndefined();
    });

    it('should sort by date descending by default', async () => {
      const result = await repository.findByCustomerId('CUST001');
      const dates = result.invoices.map((inv: Invoice) => inv.getCreatedAt().getTime());
      
      expect(dates).toEqual([...dates].sort((a: number, b: number) => b - a));
    });

    it('should support custom sort orders', async () => {
      const resultAsc = await repository.findByCustomerId('CUST001', {
        sortBy: 'date',
        sortOrder: 'asc'
      });
      const datesAsc = resultAsc.invoices.map((inv: Invoice) => inv.getCreatedAt().getTime());
      expect(datesAsc).toEqual([...datesAsc].sort((a: number, b: number) => a - b));
      
      const resultDesc = await repository.findByCustomerId('CUST001', {
        sortBy: 'total',
        sortOrder: 'desc'
      });
      const totalsDesc = resultDesc.invoices.map((inv: Invoice) => inv.total.getAmount());
      expect(totalsDesc).toEqual([...totalsDesc].sort((a: number, b: number) => b - a));
    });

    it('should return empty array for customer with no invoices', async () => {
      const result = await repository.findByCustomerId('CUST999');
      expect(result.invoices).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe('findByDateRange', () => {
    beforeEach(async () => {
      // Create invoices across different dates and statuses
      const testInvoices = [
        createTestInvoice({
          invoiceDate: new Date('2024-01-01')
        }),
        createTestInvoice({
          invoiceDate: new Date('2024-01-15')
        }),
        createTestInvoice({
          invoiceDate: new Date('2024-02-01')
        }),
        createTestInvoice({
          invoiceDate: new Date('2024-02-15')
        })
      ];
      
      await Promise.all(testInvoices.map(inv => repository.save(inv)));
    });

    it('should return invoices within date range', async () => {
      const startDate = new Date('2024-01-10');
      const endDate = new Date('2024-02-10');
      
      const result = await repository.findByDateRange(startDate, endDate);
      
      expect(result.invoices.length).toBeGreaterThanOrEqual(2);
      result.invoices.forEach((inv: Invoice) => {
        expect(inv.getCreatedAt().getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(inv.getCreatedAt().getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    // Status filtering test removed as Invoice entity doesn't have status property
    // This would need to be implemented differently based on business requirements

    it('should filter by customerId when provided', async () => {
      const customer = new Customer(
        'CUST-SPECIAL',
        'Special Customer',
        new Address(
          '789 Pine St',
          'San Francisco',
          'CA',
          '94105'
        )
      );
      
      const specialInvoice = createTestInvoice({
        customer,
        invoiceDate: new Date('2024-01-20')
      });
      await repository.save(specialInvoice);
      
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const options: DateRangeOptions = { customerId: 'CUST-SPECIAL' };
      
      const result = await repository.findByDateRange(startDate, endDate, options);
      
      expect(result.invoices).toHaveLength(1);
      expect(result.invoices[0].customer.getId()).toBe('CUST-SPECIAL');
    });

    it('should support pagination in date range queries', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      const firstPage = await repository.findByDateRange(startDate, endDate, { limit: 2 });
      expect(firstPage.invoices).toHaveLength(2);
      expect(firstPage.nextCursor).toBeDefined();
      
      const secondPage = await repository.findByDateRange(startDate, endDate, {
        limit: 2,
        cursor: firstPage.nextCursor
      });
      expect(secondPage.invoices.length).toBeGreaterThan(0);
    });
  });

  describe('exists', () => {
    it('should return true for existing invoice', async () => {
      const invoice = createTestInvoice();
      await repository.save(invoice);
      
      const exists = await repository.exists(invoice.invoiceNumber);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent invoice', async () => {
      const exists = await repository.exists('NON-EXISTENT-ID');
      expect(exists).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle DynamoDB service errors gracefully', async () => {
      // This would test retry logic and error transformation
      // In a real test, we'd mock the DynamoDB client to simulate errors
      const badRepo = new DynamoDBInvoiceRepository(
        docClient,
        'non-existent-table'
      );
      
      await expect(badRepo.findById('test')).rejects.toThrow();
    });
  });
});