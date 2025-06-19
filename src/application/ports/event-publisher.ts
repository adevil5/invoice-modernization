/**
 * Base interface for all domain events.
 */
export interface DomainEvent {
  eventType: string;
  timestamp: Date;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Event emitted when an invoice is created.
 */
export interface InvoiceCreatedEvent extends DomainEvent {
  eventType: 'InvoiceCreated';
  invoiceId: string;
  customerId: string;
  total: number;
  dueDate: string;
}

/**
 * Event emitted when an invoice is processed.
 */
export interface InvoiceProcessedEvent extends DomainEvent {
  eventType: 'InvoiceProcessed';
  invoiceId: string;
  pdfUrl?: string;
  processedAt: Date;
}

/**
 * Event emitted when invoice processing fails.
 */
export interface InvoiceProcessingFailedEvent extends DomainEvent {
  eventType: 'InvoiceProcessingFailed';
  invoiceId: string;
  error: string;
  retryCount: number;
}

/**
 * Union type for all invoice-related events.
 */
export type InvoiceEvent =
  | InvoiceCreatedEvent
  | InvoiceProcessedEvent
  | InvoiceProcessingFailedEvent;

/**
 * Port interface for publishing domain events.
 * Infrastructure adapters must implement this interface.
 */
export interface EventPublisher {
  /**
   * Publish a domain event.
   * @param event - The event to publish
   * @throws Error if publishing fails
   */
  publish(event: InvoiceEvent): Promise<void>;

  /**
   * Publish multiple domain events as a batch.
   * @param events - Array of events to publish
   * @throws Error if publishing fails
   */
  publishBatch?(events: InvoiceEvent[]): Promise<void>;
}