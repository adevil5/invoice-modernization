import type { Invoice } from '../../domain/entities/invoice.js';

/**
 * Port interface for PDF generation.
 * Infrastructure adapters must implement this interface.
 */
export interface PdfGenerator {
  /**
   * Generate a PDF document for an invoice.
   * @param invoice - The invoice to generate PDF for
   * @returns Buffer containing the PDF data
   * @throws Error if PDF generation fails
   */
  generateInvoicePdf(invoice: Invoice): Promise<Buffer>;

  /**
   * Generate a batch of PDF documents for multiple invoices.
   * @param invoices - Array of invoices to generate PDFs for
   * @returns Array of buffers containing PDF data
   * @throws Error if PDF generation fails
   */
  generateBatch?(invoices: Invoice[]): Promise<Buffer[]>;
}