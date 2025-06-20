import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBInvoiceRepository } from '../../../src/infrastructure/repositories/dynamodb-invoice-repository.js';
import { Invoice } from '../../../src/domain/entities/invoice.js';
import { Customer } from '../../../src/domain/value-objects/customer.js';
import { Address } from '../../../src/domain/value-objects/address.js';
import { InvoiceItem } from '../../../src/domain/value-objects/invoice-item.js';
import { Money } from '../../../src/domain/value-objects/money.js';

// Create the mock
const ddbMock = mockClient(DynamoDBDocumentClient);

describe('DynamoDBInvoiceRepository Unit Tests', () => {
  let repository: DynamoDBInvoiceRepository;
  const tableName = 'test-invoices';

  beforeEach(() => {
    // Reset the mock before each test
    ddbMock.reset();
    
    // Create a real DynamoDBDocumentClient instance
    // The mock will intercept all calls to it
    const client = new DynamoDBClient({});
    const docClient = DynamoDBDocumentClient.from(client);
    repository = new DynamoDBInvoiceRepository(docClient, tableName);
  });

  const createTestInvoice = (): Invoice => {
    return new Invoice({
      invoiceNumber: 'INV-123',
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
          'Test Item',
          2,
          new Money(50.00)
        )
      ],
      invoiceDate: new Date('2024-01-15'),
      dueDate: new Date('2024-02-14')
    });
  };

  describe('save', () => {
    it('should save an invoice to DynamoDB', async () => {
      const invoice = createTestInvoice();
      
      // Mock the PutCommand response
      ddbMock.on(PutCommand).resolves({});

      await repository.save(invoice);

      // Verify the command was called with correct parameters
      expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
      expect(ddbMock.commandCalls(PutCommand)[0].args[0].input).toEqual(
        expect.objectContaining({
          TableName: tableName,
          Item: expect.objectContaining({
            invoiceId: 'INV-123',
            customerId: 'CUST123'
          })
        })
      );
    });

    it('should handle DynamoDB errors', async () => {
      const invoice = createTestInvoice();
      
      // Mock a ResourceNotFoundException
      const error = new Error('Requested resource not found');
      (error as any).name = 'ResourceNotFoundException';
      ddbMock.on(PutCommand).rejects(error);

      await expect(repository.save(invoice)).rejects.toThrow(
        `DynamoDB table '${tableName}' not found`
      );
    });
  });

  describe('findById', () => {
    it('should return null when invoice not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const result = await repository.findById('NON-EXISTENT');

      expect(result).toBeNull();
      expect(ddbMock.commandCalls(GetCommand)).toHaveLength(1);
      expect(ddbMock.commandCalls(GetCommand)[0].args[0].input).toEqual(
        expect.objectContaining({
          TableName: tableName,
          Key: {
            invoiceId: 'NON-EXISTENT'
          }
        })
      );
    });

    it('should return invoice when found', async () => {
      const mockItem = {
        invoiceId: 'INV-123',
        invoiceNumber: 'INV-123',
        customerId: 'CUST123',
        customerName: 'Test Company',
        customerAddress: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105'
        },
        items: [{
          description: 'Test Item',
          quantity: 2,
          unitPrice: 50.00
        }],
        subtotal: 100.00,
        tax: 7.25,
        total: 107.25,
        invoiceDate: '2024-01-15T00:00:00.000Z',
        dueDate: '2024-02-14T00:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z'
      };

      ddbMock.on(GetCommand).resolves({ Item: mockItem });

      const result = await repository.findById('INV-123');

      expect(result).not.toBeNull();
      expect(result?.invoiceNumber).toBe('INV-123');
      expect(result?.customer.getId()).toBe('CUST123');
    });
  });

  describe('findByCustomerId', () => {
    it('should return invoices for a customer', async () => {
      const mockItems = [{
        invoiceId: 'INV-123',
        invoiceNumber: 'INV-123',
        customerId: 'CUST123',
        customerName: 'Test Company',
        customerAddress: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105'
        },
        items: [{
          description: 'Test Item',
          quantity: 2,
          unitPrice: 50.00
        }],
        subtotal: 100.00,
        tax: 7.25,
        total: 107.25,
        invoiceDate: '2024-01-15T00:00:00.000Z',
        dueDate: '2024-02-14T00:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z'
      }];

      ddbMock.on(QueryCommand).resolves({ 
        Items: mockItems,
        LastEvaluatedKey: undefined 
      });

      const result = await repository.findByCustomerId('CUST123');

      expect(result.invoices).toHaveLength(1);
      expect(result.invoices[0].customer.getId()).toBe('CUST123');
      expect(result.nextCursor).toBeUndefined();
    });

    it('should handle pagination', async () => {
      const lastKey = { invoiceId: 'INV-123', customerId: 'CUST123' };
      
      ddbMock.on(QueryCommand).resolves({ 
        Items: [],
        LastEvaluatedKey: lastKey 
      });

      const result = await repository.findByCustomerId('CUST123', { limit: 10 });

      expect(result.nextCursor).toBeDefined();
      expect(ddbMock.commandCalls(QueryCommand)[0].args[0].input).toEqual(
        expect.objectContaining({
          Limit: 10
        })
      );
    });
  });

  describe('findByDateRange', () => {
    it('should return invoices within date range', async () => {
      const mockItems = [{
        invoiceId: 'INV-123',
        invoiceNumber: 'INV-123',
        customerId: 'CUST123',
        customerName: 'Test Company',
        customerAddress: {
          street: '123 Main St',
          city: 'San Francisco',
          state: 'CA',
          zip: '94105'
        },
        items: [{
          description: 'Test Item',
          quantity: 2,
          unitPrice: 50.00
        }],
        subtotal: 100.00,
        tax: 7.25,
        total: 107.25,
        invoiceDate: '2024-01-15T00:00:00.000Z',
        dueDate: '2024-02-14T00:00:00.000Z',
        createdAt: '2024-01-15T10:00:00.000Z'
      }];

      ddbMock.on(ScanCommand).resolves({
        Items: mockItems,
        LastEvaluatedKey: undefined
      });

      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      const result = await repository.findByDateRange(startDate, endDate);

      expect(result.invoices).toHaveLength(1);
      expect(ddbMock.commandCalls(ScanCommand)[0].args[0].input).toEqual(
        expect.objectContaining({
          FilterExpression: 'createdAt BETWEEN :start AND :end'
        })
      );
    });
  });

  describe('exists', () => {
    it('should return true when invoice exists', async () => {
      ddbMock.on(GetCommand).resolves({ 
        Item: { invoiceId: 'INV-123' } 
      });

      const exists = await repository.exists('INV-123');

      expect(exists).toBe(true);
    });

    it('should return false when invoice does not exist', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const exists = await repository.exists('NON-EXISTENT');

      expect(exists).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should map validation exceptions', async () => {
      const error = new Error('One or more parameter values were invalid');
      (error as any).name = 'ValidationException';
      
      ddbMock.on(GetCommand).rejects(error);

      await expect(repository.findById('test')).rejects.toThrow(
        'Invalid DynamoDB operation: One or more parameter values were invalid'
      );
    });

    it('should map rate limit exceptions', async () => {
      const error = new Error('Throughput exceeds the current throughput limit');
      (error as any).name = 'ProvisionedThroughputExceededException';
      
      ddbMock.on(GetCommand).rejects(error);

      await expect(repository.findById('test')).rejects.toThrow(
        'DynamoDB rate limit exceeded for findById'
      );
    });
  });
});