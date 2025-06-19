# Application Layer Patterns

This guide documents the application layer patterns and architectural decisions in the invoice modernization project.

## Port-Adapter Pattern

### Port Interface Design

All infrastructure dependencies are abstracted through port interfaces:

```typescript
// Port interface - defines the contract
export interface InvoiceRepository {
  save(invoice: Invoice): Promise<void>;
  findById(id: string): Promise<Invoice | null>;
  exists(id: string): Promise<boolean>;
  findByCustomerId?(customerId: string): Promise<Invoice[]>; // Optional
}

// Infrastructure adapter implements the port
export class DynamoDBInvoiceRepository implements InvoiceRepository {
  // Implementation details hidden from application layer
}
```

### Optional Methods Pattern

Port interfaces use optional methods (marked with `?`) for non-essential functionality:

```typescript
export interface EventPublisher {
  publish(event: InvoiceEvent): Promise<void>;
  publishBatch?(events: InvoiceEvent[]): Promise<void>; // Optional batch support
}
```

This allows flexible adapter implementations while maintaining the core contract.

## Use Case Patterns

### Constructor Dependency Injection

All dependencies are injected through constructor for testability:

```typescript
export class ProcessInvoiceUseCase {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly pdfGenerator: PdfGenerator,
    private readonly documentRepository: DocumentRepository,
    private readonly eventPublisher: EventPublisher
  ) {}
}
```

### Two-Phase Validation

Use cases validate in two phases to provide comprehensive error feedback:

```typescript
async execute(dto: CreateInvoiceDto): Promise<Invoice> {
  // Phase 1: DTO validation (structure, types, basic rules)
  const validationErrors: Error[] = [];
  try {
    this.validateDto(dto);
  } catch (error) {
    // Collect errors instead of fail-fast
  }

  // Phase 2: Business rule validation (after domain objects created)
  const businessRuleErrors = this.validationService.validateBusinessRules(
    invoice.customer,
    invoice.items
  );
  
  // Throw composite error with all issues
  if (errors.length > 0) {
    throw new CompositeValidationError('Validation failed', errors);
  }
}
```

### Result Objects

Process use cases return structured result objects instead of raw entities:

```typescript
export interface ProcessInvoiceResult {
  invoiceId: string;
  pdfUrl: string;
  processedAt: Date;
}
```

## Event Publishing Patterns

### Fire-and-Forget Pattern

Event publishing failures don't fail the main operation:

```typescript
try {
  await this.eventPublisher.publish(event);
} catch (error) {
  // Log but don't throw - ensures resilience
  console.error('Failed to publish event:', error);
}
```

### Event Type Hierarchy

Events follow a consistent structure:

```typescript
// Base event interface
export interface DomainEvent {
  eventType: string;
  timestamp: Date;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

// Specific event types
export interface InvoiceProcessedEvent extends DomainEvent {
  eventType: 'InvoiceProcessed';
  invoiceId: string;
  pdfUrl?: string;
  processedAt: Date;
}

// Type-safe union
export type InvoiceEvent = 
  | InvoiceCreatedEvent 
  | InvoiceProcessedEvent 
  | InvoiceProcessingFailedEvent;
```

### Correlation ID Pattern

Optional correlation IDs propagate through the processing chain:

```typescript
// Use optional spread pattern for TypeScript strict mode
const event: InvoiceProcessedEvent = {
  eventType: 'InvoiceProcessed',
  invoiceId: invoiceNumber,
  timestamp: new Date(),
  ...(correlationId && { correlationId }), // Only include if defined
};
```

## Error Handling Strategies

### Graceful Degradation

Non-critical operations fail gracefully:

```typescript
// Event publishing failure doesn't fail invoice creation
try {
  await this.eventPublisher.publish(event);
} catch (error) {
  console.error('Failed to publish InvoiceCreated event:', error);
  // Continue with successful response
}
```

### Error Event Publishing

Failed operations publish failure events for observability:

```typescript
catch (error) {
  const failureEvent: InvoiceProcessingFailedEvent = {
    eventType: 'InvoiceProcessingFailed',
    invoiceId: invoiceNumber,
    error: error instanceof Error ? error.message : 'Unknown error',
    retryCount: retryCount + 1,
    timestamp: new Date(),
  };
  
  await this.eventPublisher.publish(failureEvent);
  throw error; // Re-throw original error
}
```

### Duplicate Prevention

Existence checks prevent duplicate entity creation:

```typescript
const exists = await this.invoiceRepository.exists(dto.invoiceNumber);
if (exists) {
  throw new InvoiceValidationError(
    `Invoice number ${dto.invoiceNumber} already exists`
  );
}
```

## Data Transfer Patterns

### DTO Simplicity

DTOs use primitive types for simplicity at boundaries:

```typescript
export interface CreateInvoiceDto {
  invoiceNumber: string;
  invoiceDate: string;    // ISO date string, not Date object
  dueDate: string;        // ISO date string
  items: {
    description: string;
    quantity: number;
    unitPrice: number;    // Number, not Money object
  }[];
}
```

### Date Handling

Parse dates at noon local time to avoid timezone issues:

```typescript
// Timezone-neutral parsing
const invoiceDate = new Date(dto.invoiceDate + 'T12:00:00');
const dueDate = new Date(dto.dueDate + 'T12:00:00');
```

## Repository Patterns

### Pagination Support

Repositories support cursor-based pagination:

```typescript
export interface InvoiceRepository {
  findByDateRange(
    startDate: Date,
    endDate: Date,
    options?: {
      limit?: number;
      cursor?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ): Promise<{
    items: Invoice[];
    nextCursor?: string;
  }>;
}
```

### Document Storage Pattern

Document repositories use hierarchical keys:

```typescript
// Consistent key structure
const documentKey = `invoices/${invoiceNumber}.pdf`;
await this.documentRepository.save(documentKey, pdfBuffer, 'application/pdf');

// URL generation instead of content retrieval
const pdfUrl = await this.documentRepository.getUrl(documentKey);
```

## Service Instantiation

Domain services are instantiated within use cases (not injected):

```typescript
export class CreateInvoiceUseCase {
  private readonly validationService: ValidationService;

  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly eventPublisher: EventPublisher
  ) {
    // Stateless domain service instantiated, not injected
    this.validationService = new ValidationService();
  }
}
```

This indicates domain services are stateless utilities without infrastructure dependencies.

## Testing Patterns

### Mock Everything

All infrastructure dependencies are mocked:

```typescript
let mockInvoiceRepository: jest.Mocked<InvoiceRepository>;
let mockEventPublisher: jest.Mocked<EventPublisher>;

beforeEach(() => {
  mockInvoiceRepository = {
    save: jest.fn(),
    findById: jest.fn(),
    exists: jest.fn(),
  };
  
  mockEventPublisher = {
    publish: jest.fn(),
  };
});
```

### Verify Event Publishing

Events can be verified independently:

```typescript
expect(mockEventPublisher.publish).toHaveBeenCalledWith({
  eventType: 'InvoiceProcessed',
  invoiceId: invoiceNumber,
  correlationId: expect.any(String),
  timestamp: expect.any(Date) as Date, // Type assertion for Jest matchers
});
```

### Error Scenario Testing

Test both success and failure paths:

```typescript
it('should publish failure event when PDF generation fails', async () => {
  mockPdfGenerator.generateInvoicePdf.mockRejectedValue(new Error('PDF failed'));
  
  await expect(useCase.execute(invoiceNumber)).rejects.toThrow('PDF failed');
  
  expect(mockEventPublisher.publish).toHaveBeenCalledWith(
    expect.objectContaining({
      eventType: 'InvoiceProcessingFailed',
      error: 'PDF failed',
    })
  );
});
```