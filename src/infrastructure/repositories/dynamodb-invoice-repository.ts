import type {
  DynamoDBDocumentClient,
  QueryCommandInput,
  ScanCommandInput
} from '@aws-sdk/lib-dynamodb';
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand
} from '@aws-sdk/lib-dynamodb';
import type { 
  InvoiceRepository,
  FindOptions,
  FindResult,
  DateRangeOptions 
} from '@application/ports/invoice-repository';
import { Invoice } from '@domain/entities/invoice';
import { Customer } from '@domain/value-objects/customer';
import { Address } from '@domain/value-objects/address';
import { InvoiceItem } from '@domain/value-objects/invoice-item';
import { Money } from '@domain/value-objects/money';

interface DynamoDBInvoiceItem {
  invoiceId: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  subtotal: number;
  tax: number;
  total: number;
  invoiceDate: string;
  dueDate: string;
  createdAt: string;
  // Status will be computed based on invoice state
  // paidAt, updatedAt, taxRate fields might be added later if needed
}

export class DynamoDBInvoiceRepository implements InvoiceRepository {
  constructor(
    private readonly docClient: DynamoDBDocumentClient,
    private readonly tableName: string
  ) {}

  async save(invoice: Invoice): Promise<void> {
    const item = this.toDynamoDBItem(invoice);
    
    try {
      await this.docClient.send(new PutCommand({
        TableName: this.tableName,
        Item: item,
        ConditionExpression: 'attribute_not_exists(invoiceId) OR invoiceId = :id',
        ExpressionAttributeValues: {
          ':id': item.invoiceId
        }
      }));
    } catch (error) {
      throw this.mapError(error, 'save', invoice.invoiceNumber);
    }
  }

  async findById(invoiceNumber: string): Promise<Invoice | null> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: {
          invoiceId: invoiceNumber
        }
      }));

      if (!result.Item) {
        return null;
      }

      return this.fromDynamoDBItem(result.Item as DynamoDBInvoiceItem);
    } catch (error) {
      throw this.mapError(error, 'findById', invoiceNumber);
    }
  }

  async findByCustomerId(customerId: string, options?: FindOptions): Promise<FindResult> {
    const limit = options?.limit || 20;
    const sortBy = options?.sortBy || 'date';
    const sortOrder = options?.sortOrder || 'desc';

    try {
      const queryInput: QueryCommandInput = {
        TableName: this.tableName,
        IndexName: 'customerId-createdAt-index',
        KeyConditionExpression: 'customerId = :customerId',
        ExpressionAttributeValues: {
          ':customerId': customerId
        },
        ScanIndexForward: sortOrder === 'asc',
        Limit: limit
      };

      if (options?.cursor) {
        queryInput.ExclusiveStartKey = this.decodeCursor(options.cursor);
      }

      const result = await this.docClient.send(new QueryCommand(queryInput));
      
      const invoices = (result.Items || [])
        .map(item => this.fromDynamoDBItem(item as DynamoDBInvoiceItem));

      // Apply in-memory sorting if sorting by total (not supported by GSI)
      if (sortBy === 'total') {
        invoices.sort((a, b) => {
          const diff = a.total.getAmount() - b.total.getAmount();
          return sortOrder === 'asc' ? diff : -diff;
        });
      }

      const response: FindResult = {
        invoices
      };
      if (result.LastEvaluatedKey) {
        response.nextCursor = this.encodeCursor(result.LastEvaluatedKey);
      }
      return response;
    } catch (error) {
      throw this.mapError(error, 'findByCustomerId', customerId);
    }
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: DateRangeOptions
  ): Promise<FindResult> {
    const limit = options?.limit || 20;
    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();

    try {
      // Use scan for date range queries since we don't have a suitable GSI
      // In production, we would need to create appropriate GSIs
      const scanInput: ScanCommandInput = {
        TableName: this.tableName,
        FilterExpression: 'createdAt BETWEEN :start AND :end',
        ExpressionAttributeValues: {
          ':start': startDateStr,
          ':end': endDateStr
        },
        Limit: limit
      };
      
      // Add status filter if provided
      // Status would need to be computed based on invoice state
      if (options?.status) {
        // This would need implementation based on business rules
        // For now, we'll skip status filtering
      }

      // Add customer filter if provided
      if (options?.customerId) {
        scanInput.FilterExpression += ' AND customerId = :customerId';
        if (!scanInput.ExpressionAttributeValues) {
          scanInput.ExpressionAttributeValues = {};
        }
        scanInput.ExpressionAttributeValues[':customerId'] = options.customerId;
      }

      if (options?.cursor) {
        scanInput.ExclusiveStartKey = this.decodeCursor(options.cursor);
      }

      const result = await this.docClient.send(new ScanCommand(scanInput));
      
      const invoices = (result.Items || [])
        .map(item => this.fromDynamoDBItem(item as DynamoDBInvoiceItem));

      const response: FindResult = {
        invoices
      };
      if (result.LastEvaluatedKey) {
        response.nextCursor = this.encodeCursor(result.LastEvaluatedKey);
      }
      return response;
    } catch (error) {
      throw this.mapError(error, 'findByDateRange', `${startDateStr} - ${endDateStr}`);
    }
  }

  async exists(invoiceNumber: string): Promise<boolean> {
    try {
      const result = await this.docClient.send(new GetCommand({
        TableName: this.tableName,
        Key: {
          invoiceId: invoiceNumber
        },
        ProjectionExpression: 'invoiceId'
      }));

      return !!result.Item;
    } catch (error) {
      throw this.mapError(error, 'exists', invoiceNumber);
    }
  }

  private toDynamoDBItem(invoice: Invoice): DynamoDBInvoiceItem {
    return {
      invoiceId: invoice.invoiceNumber,
      invoiceNumber: invoice.invoiceNumber,
      customerId: invoice.customer.getId(),
      customerName: invoice.customer.getName(),
      customerAddress: {
        street: invoice.customer.getAddress().getStreet(),
        city: invoice.customer.getAddress().getCity(),
        state: invoice.customer.getAddress().getState(),
        zip: invoice.customer.getAddress().getZip()
      },
      items: invoice.items.map(item => ({
        description: item.getDescription(),
        quantity: item.getQuantity(),
        unitPrice: item.getUnitPrice().getAmount()
      })),
      subtotal: invoice.subtotal.getAmount(),
      tax: invoice.tax.getAmount(),
      total: invoice.total.getAmount(),
      invoiceDate: invoice.invoiceDate.toISOString(),
      dueDate: invoice.dueDate.toISOString(),
      createdAt: invoice.getCreatedAt().toISOString()
    };
  }

  private fromDynamoDBItem(item: DynamoDBInvoiceItem): Invoice {
    const customer = new Customer(
      item.customerId,
      item.customerName,
      new Address(
        item.customerAddress.street,
        item.customerAddress.city,
        item.customerAddress.state,
        item.customerAddress.zip
      )
    );

    const items = item.items.map(i => new InvoiceItem(
      i.description,
      i.quantity,
      new Money(i.unitPrice)
    ));

    // Create the invoice
    return new Invoice({
      invoiceNumber: item.invoiceNumber,
      customer,
      items,
      invoiceDate: new Date(item.invoiceDate),
      dueDate: new Date(item.dueDate)
    });
  }

  private encodeCursor(lastEvaluatedKey: Record<string, unknown>): string {
    return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64');
  }

  private decodeCursor(cursor: string): Record<string, unknown> {
    try {
      const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
      if (decoded && typeof decoded === 'object') {
        return decoded as Record<string, unknown>;
      }
      throw new Error('Invalid cursor format');
    } catch {
      throw new Error('Invalid cursor format');
    }
  }

  private mapError(error: unknown, operation: string, context: string): Error {
    const errorObj = error as Error;
    const message = errorObj.message || 'Unknown error';
    const errorName = errorObj.name || 'Error';
    
    if (errorName === 'ResourceNotFoundException') {
      return new Error(`DynamoDB table '${this.tableName}' not found`);
    }
    
    if (errorName === 'ValidationException') {
      return new Error(`Invalid DynamoDB operation: ${message}`);
    }
    
    if (errorName === 'ProvisionedThroughputExceededException' || 
        errorName === 'RequestLimitExceeded') {
      return new Error(`DynamoDB rate limit exceeded for ${operation}`);
    }
    
    return new Error(
      `DynamoDB operation '${operation}' failed for ${context}: ${message}`
    );
  }
}