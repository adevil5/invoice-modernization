/* eslint-disable @typescript-eslint/unbound-method */

import { ProcessInvoiceUseCase } from '../../../src/application/use-cases/process-invoice';
import type { InvoiceRepository } from '../../../src/application/ports/invoice-repository';
import type { EventPublisher } from '../../../src/application/ports/event-publisher';
import type { PdfGenerator } from '../../../src/application/ports/pdf-generator';
import type { DocumentRepository } from '../../../src/application/ports/document-repository';
import { Invoice } from '../../../src/domain/entities/invoice';
import { Address } from '../../../src/domain/value-objects/address';
import { Customer } from '../../../src/domain/value-objects/customer';
import { InvoiceItem } from '../../../src/domain/value-objects/invoice-item';
import { Money } from '../../../src/domain/value-objects/money';
import { InvoiceNotFoundError } from '../../../src/domain/exceptions/invoice-not-found-error';

describe('ProcessInvoiceUseCase', () => {
  let mockInvoiceRepository: jest.Mocked<InvoiceRepository>;
  let mockEventPublisher: jest.Mocked<EventPublisher>;
  let mockPdfGenerator: jest.Mocked<PdfGenerator>;
  let mockDocumentRepository: jest.Mocked<DocumentRepository>;
  let processInvoiceUseCase: ProcessInvoiceUseCase;

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

    mockPdfGenerator = {
      generateInvoicePdf: jest.fn(),
    };

    mockDocumentRepository = {
      save: jest.fn(),
      getUrl: jest.fn(),
    };

    processInvoiceUseCase = new ProcessInvoiceUseCase(
      mockInvoiceRepository,
      mockPdfGenerator,
      mockDocumentRepository,
      mockEventPublisher
    );
  });

  describe('execute', () => {
    it('should process an invoice and generate PDF', async () => {
      // Arrange
      const invoiceNumber = 'INV-2024-001';
      const mockInvoice = createMockInvoice(invoiceNumber);
      const mockPdfBuffer = Buffer.from('mock-pdf-content');
      const mockPdfUrl = 'https://s3.amazonaws.com/invoices/INV-2024-001.pdf';

      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);
      mockPdfGenerator.generateInvoicePdf.mockResolvedValue(mockPdfBuffer);
      mockDocumentRepository.save.mockResolvedValue(undefined);
      mockDocumentRepository.getUrl.mockResolvedValue(mockPdfUrl);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      // Act
      const result = await processInvoiceUseCase.execute(invoiceNumber);

      // Assert
      expect(result).toEqual({
        invoiceId: invoiceNumber,
        pdfUrl: mockPdfUrl,
        processedAt: expect.any(Date) as Date,
      });

      expect(mockInvoiceRepository.findById).toHaveBeenCalledWith(invoiceNumber);
      expect(mockPdfGenerator.generateInvoicePdf).toHaveBeenCalledWith(mockInvoice);
      expect(mockDocumentRepository.save).toHaveBeenCalledWith(
        `invoices/${invoiceNumber}.pdf`,
        mockPdfBuffer,
        'application/pdf'
      );
      expect(mockDocumentRepository.getUrl).toHaveBeenCalledWith(
        `invoices/${invoiceNumber}.pdf`
      );
      expect(mockEventPublisher.publish).toHaveBeenCalledWith({
        eventType: 'InvoiceProcessed',
        invoiceId: invoiceNumber,
        pdfUrl: mockPdfUrl,
        processedAt: expect.any(Date) as Date,
        timestamp: expect.any(Date) as Date,
      });
    });

    it('should throw error when invoice is not found', async () => {
      // Arrange
      const invoiceNumber = 'INV-NOT-EXISTS';
      mockInvoiceRepository.findById.mockResolvedValue(null);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      // Act & Assert
      await expect(processInvoiceUseCase.execute(invoiceNumber)).rejects.toThrow(
        InvoiceNotFoundError
      );
      expect(mockInvoiceRepository.findById).toHaveBeenCalledWith(invoiceNumber);
      expect(mockPdfGenerator.generateInvoicePdf).not.toHaveBeenCalled();
      expect(mockDocumentRepository.save).not.toHaveBeenCalled();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith({
        eventType: 'InvoiceProcessingFailed',
        invoiceId: invoiceNumber,
        error: 'Invoice not found: INV-NOT-EXISTS',
        retryCount: 1,
        timestamp: expect.any(Date) as Date,
      });
    });

    it('should publish failure event when PDF generation fails', async () => {
      // Arrange
      const invoiceNumber = 'INV-2024-002';
      const mockInvoice = createMockInvoice(invoiceNumber);
      const pdfError = new Error('PDF generation failed');

      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);
      mockPdfGenerator.generateInvoicePdf.mockRejectedValue(pdfError);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      // Act & Assert
      await expect(processInvoiceUseCase.execute(invoiceNumber)).rejects.toThrow(
        'PDF generation failed'
      );

      expect(mockEventPublisher.publish).toHaveBeenCalledWith({
        eventType: 'InvoiceProcessingFailed',
        invoiceId: invoiceNumber,
        error: 'PDF generation failed',
        retryCount: 1,
        timestamp: expect.any(Date) as Date,
      });
    });

    it('should publish failure event when document save fails', async () => {
      // Arrange
      const invoiceNumber = 'INV-2024-003';
      const mockInvoice = createMockInvoice(invoiceNumber);
      const mockPdfBuffer = Buffer.from('mock-pdf-content');
      const saveError = new Error('S3 save failed');

      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);
      mockPdfGenerator.generateInvoicePdf.mockResolvedValue(mockPdfBuffer);
      mockDocumentRepository.save.mockRejectedValue(saveError);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      // Act & Assert
      await expect(processInvoiceUseCase.execute(invoiceNumber)).rejects.toThrow(
        'S3 save failed'
      );

      expect(mockEventPublisher.publish).toHaveBeenCalledWith({
        eventType: 'InvoiceProcessingFailed',
        invoiceId: invoiceNumber,
        error: 'S3 save failed',
        retryCount: 1,
        timestamp: expect.any(Date) as Date,
      });
    });

    it('should handle large invoices with many items', async () => {
      // Arrange
      const invoiceNumber = 'INV-2024-LARGE';
      const mockInvoice = createMockInvoiceWithManyItems(invoiceNumber, 100);
      const mockPdfBuffer = Buffer.from('large-pdf-content');
      const mockPdfUrl = `https://s3.amazonaws.com/invoices/${invoiceNumber}.pdf`;

      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);
      mockPdfGenerator.generateInvoicePdf.mockResolvedValue(mockPdfBuffer);
      mockDocumentRepository.save.mockResolvedValue(undefined);
      mockDocumentRepository.getUrl.mockResolvedValue(mockPdfUrl);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      // Act
      const result = await processInvoiceUseCase.execute(invoiceNumber);

      // Assert
      expect(result.invoiceId).toBe(invoiceNumber);
      expect(mockPdfGenerator.generateInvoicePdf).toHaveBeenCalledWith(mockInvoice);
    });

    it('should include correlation ID in events when provided', async () => {
      // Arrange
      const invoiceNumber = 'INV-2024-004';
      const correlationId = 'corr-123-456';
      const mockInvoice = createMockInvoice(invoiceNumber);
      const mockPdfBuffer = Buffer.from('mock-pdf-content');
      const mockPdfUrl = `https://s3.amazonaws.com/invoices/${invoiceNumber}.pdf`;

      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);
      mockPdfGenerator.generateInvoicePdf.mockResolvedValue(mockPdfBuffer);
      mockDocumentRepository.save.mockResolvedValue(undefined);
      mockDocumentRepository.getUrl.mockResolvedValue(mockPdfUrl);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      // Act
      const result = await processInvoiceUseCase.execute(invoiceNumber, correlationId);

      // Assert
      expect(result).toBeDefined();
      expect(mockEventPublisher.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'InvoiceProcessed',
          correlationId,
        })
      );
    });

    it('should retry processing with incremented retry count', async () => {
      // Arrange
      const invoiceNumber = 'INV-2024-005';
      const retryCount = 2;
      const mockInvoice = createMockInvoice(invoiceNumber);
      const pdfError = new Error('Temporary failure');

      mockInvoiceRepository.findById.mockResolvedValue(mockInvoice);
      mockPdfGenerator.generateInvoicePdf.mockRejectedValue(pdfError);
      mockEventPublisher.publish.mockResolvedValue(undefined);

      // Act & Assert
      await expect(
        processInvoiceUseCase.execute(invoiceNumber, undefined, retryCount)
      ).rejects.toThrow('Temporary failure');

      expect(mockEventPublisher.publish).toHaveBeenCalledWith({
        eventType: 'InvoiceProcessingFailed',
        invoiceId: invoiceNumber,
        error: 'Temporary failure',
        retryCount: 3, // Should be incremented
        timestamp: expect.any(Date) as Date,
      });
    });
  });

  // Helper functions
  function createMockInvoice(invoiceNumber: string): Invoice {
    const address = new Address('123 Main St', 'New York', 'NY', '10001');
    const customer = new Customer('CUST123', 'Acme Corp', address);
    const items = [
      new InvoiceItem('Product A', 10, new Money(100.0)),
      new InvoiceItem('Product B', 5, new Money(50.0)),
    ];

    return new Invoice({
      invoiceNumber,
      customer,
      items,
      invoiceDate: new Date('2024-01-15'),
      dueDate: new Date('2024-02-15'),
    });
  }

  function createMockInvoiceWithManyItems(
    invoiceNumber: string,
    itemCount: number
  ): Invoice {
    const address = new Address('123 Main St', 'New York', 'NY', '10001');
    const customer = new Customer('CUST123', 'Acme Corp', address);
    const items = Array.from({ length: itemCount }, (_, i) => 
      new InvoiceItem(`Product ${i + 1}`, i + 1, new Money((i + 1) * 10))
    );

    return new Invoice({
      invoiceNumber,
      customer,
      items,
      invoiceDate: new Date('2024-01-15'),
      dueDate: new Date('2024-02-15'),
    });
  }
});