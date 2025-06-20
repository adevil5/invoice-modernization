import 'aws-sdk-client-mock-jest';
import { Invoice } from '../../../src/domain/entities/invoice';
import { Customer } from '../../../src/domain/value-objects/customer';
import { Address } from '../../../src/domain/value-objects/address';
import { InvoiceItem } from '../../../src/domain/value-objects/invoice-item';
import { Money } from '../../../src/domain/value-objects/money';

import { mockClient } from 'aws-sdk-client-mock';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

// Import after imports
import { DynamoDBInvoiceRepository } from '../../../src/infrastructure/repositories/dynamodb-invoice-repository';

// Create the mock
const ddbMock = mockClient(DynamoDBDocumentClient);

describe('DynamoDBInvoiceRepository with mocked AWS SDK', () => {
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

      // Verify the command was called
      expect(ddbMock.commandCalls(PutCommand)).toHaveLength(1);
    });
  });

  describe('findById', () => {
    it('should return null when invoice not found', async () => {
      ddbMock.on(GetCommand).resolves({ Item: undefined });

      const result = await repository.findById('NON-EXISTENT');

      expect(result).toBeNull();
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

  describe('error handling', () => {
    it('should map DynamoDB errors correctly', async () => {
      const error = new Error('Table not found') as Error & { name: string };
      error.name = 'ResourceNotFoundException';
      ddbMock.on(PutCommand).rejects(error);

      await expect(repository.save(createTestInvoice())).rejects.toThrow(
        `DynamoDB table '${tableName}' not found`
      );
    });
  });
});