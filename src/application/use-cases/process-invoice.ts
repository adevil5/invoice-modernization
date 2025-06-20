import { InvoiceNotFoundError } from '@domain/exceptions/invoice-not-found-error';
import type { InvoiceRepository } from '../ports/invoice-repository';
import type { PdfGenerator } from '../ports/pdf-generator';
import type { DocumentRepository } from '../ports/document-repository';
import type { EventPublisher, InvoiceProcessedEvent, InvoiceProcessingFailedEvent } from '../ports/event-publisher';

/**
 * Result of processing an invoice.
 */
export interface ProcessInvoiceResult {
  invoiceId: string;
  pdfUrl: string;
  processedAt: Date;
}

/**
 * Use case for processing an invoice.
 * Generates a PDF and stores it, then publishes an event.
 */
export class ProcessInvoiceUseCase {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly pdfGenerator: PdfGenerator,
    private readonly documentRepository: DocumentRepository,
    private readonly eventPublisher: EventPublisher
  ) {}

  /**
   * Execute the process invoice use case.
   * @param invoiceNumber - The invoice number to process
   * @param correlationId - Optional correlation ID for tracing
   * @param retryCount - Current retry count (default 0)
   * @returns The processing result with PDF URL
   * @throws InvoiceNotFoundError if invoice doesn't exist
   * @throws Error if processing fails
   */
  async execute(
    invoiceNumber: string,
    correlationId?: string,
    retryCount = 0
  ): Promise<ProcessInvoiceResult> {
    try {
      // Retrieve the invoice
      const invoice = await this.invoiceRepository.findById(invoiceNumber);
      if (!invoice) {
        throw new InvoiceNotFoundError(invoiceNumber);
      }

      // Generate PDF
      const pdfBuffer = await this.pdfGenerator.generateInvoicePdf(invoice);

      // Save PDF to document storage
      const documentKey = `invoices/${invoiceNumber}.pdf`;
      await this.documentRepository.save(documentKey, pdfBuffer, 'application/pdf');

      // Get public URL for the PDF
      const pdfUrl = await this.documentRepository.getUrl(documentKey);

      // Create result
      const processedAt = new Date();
      const result: ProcessInvoiceResult = {
        invoiceId: invoiceNumber,
        pdfUrl,
        processedAt,
      };

      // Publish success event
      const successEvent: InvoiceProcessedEvent = {
        eventType: 'InvoiceProcessed',
        invoiceId: invoiceNumber,
        pdfUrl,
        processedAt,
        timestamp: new Date(),
        ...(correlationId && { correlationId }),
      };

      await this.eventPublisher.publish(successEvent);

      return result;
    } catch (error) {
      // Publish failure event
      const failureEvent: InvoiceProcessingFailedEvent = {
        eventType: 'InvoiceProcessingFailed',
        invoiceId: invoiceNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
        retryCount: retryCount + 1,
        timestamp: new Date(),
        ...(correlationId && { correlationId }),
      };

      try {
        await this.eventPublisher.publish(failureEvent);
      } catch (publishError) {
        // Log but don't throw - we still want to throw the original error
        // eslint-disable-next-line no-console
        console.error('Failed to publish failure event:', publishError);
      }

      // Re-throw the original error
      throw error;
    }
  }
}