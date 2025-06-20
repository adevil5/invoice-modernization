import { Invoice } from '@domain/entities/invoice';
import { Address } from '@domain/value-objects/address';
import { Customer } from '@domain/value-objects/customer';
import { InvoiceItem } from '@domain/value-objects/invoice-item';
import { Money } from '@domain/value-objects/money';
import { ValidationService } from '@domain/services/validation-service';
import { InvoiceValidationError } from '@domain/exceptions/invoice-validation-error';
import { CompositeValidationError } from '@domain/exceptions/validation-errors';
import type { InvoiceRepository } from '../ports/invoice-repository';
import type { EventPublisher, InvoiceCreatedEvent } from '../ports/event-publisher';
import type { CreateInvoiceDto } from '../dto/create-invoice-dto';

/**
 * Use case for creating a new invoice.
 * Orchestrates the creation process including validation, persistence, and event publishing.
 */
export class CreateInvoiceUseCase {
  private readonly validationService: ValidationService;

  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly eventPublisher: EventPublisher
  ) {
    this.validationService = new ValidationService();
  }

  /**
   * Execute the create invoice use case.
   * @param dto - The data transfer object containing invoice information
   * @returns The created invoice
   * @throws InvoiceValidationError if validation fails
   * @throws CompositeValidationError if multiple validation errors occur
   */
  async execute(dto: CreateInvoiceDto): Promise<Invoice> {
    // Check for duplicate invoice number
    const exists = await this.invoiceRepository.exists(dto.invoiceNumber);
    if (exists) {
      throw new InvoiceValidationError(
        `Invoice number ${dto.invoiceNumber} already exists`
      );
    }

    // Validate the input DTO
    const validationErrors: Error[] = [];

    try {
      this.validateDto(dto);
    } catch (error) {
      if (error instanceof CompositeValidationError) {
        validationErrors.push(...error.errors);
      } else if (error instanceof Error) {
        validationErrors.push(error);
      }
    }

    if (validationErrors.length > 0) {
      throw new CompositeValidationError(
        'Validation failed for invoice creation',
        validationErrors
      );
    }

    // Create domain objects
    const address = new Address(
      dto.customerAddress.street,
      dto.customerAddress.city,
      dto.customerAddress.state,
      dto.customerAddress.zip
    );

    const customer = new Customer(
      dto.customerId,
      dto.customerName,
      address
    );

    const items = dto.items.map(
      (item) =>
        new InvoiceItem(
          item.description,
          item.quantity,
          new Money(item.unitPrice)
        )
    );

    // Parse dates in a timezone-neutral way (treat as local noon to avoid timezone issues)
    const invoiceDate = new Date(dto.invoiceDate + 'T12:00:00');
    const dueDate = new Date(dto.dueDate + 'T12:00:00');

    // Create the invoice
    const invoice = new Invoice({
      invoiceNumber: dto.invoiceNumber,
      customer,
      items,
      invoiceDate,
      dueDate
    });

    // Validate business rules
    const businessRuleErrors = this.validationService.validateBusinessRules(
      invoice.customer,
      invoice.items
    );
    
    if (businessRuleErrors.length > 0) {
      // Filter out warnings for now - only throw on errors
      const errors = businessRuleErrors.filter(error => {
        if ('severity' in error && typeof error === 'object' && error !== null) {
          return (error as { severity: string }).severity === 'error';
        }
        return true;
      });
      
      if (errors.length > 0) {
        throw new CompositeValidationError('Business rule validation failed', errors);
      }
    }

    // Save the invoice
    await this.invoiceRepository.save(invoice);

    // Publish the invoice created event
    try {
      const event: InvoiceCreatedEvent = {
        eventType: 'InvoiceCreated',
        invoiceId: invoice.invoiceNumber,
        customerId: invoice.customer.getId(),
        total: invoice.total.getAmount(),
        dueDate: invoice.dueDate.toISOString(),
        timestamp: new Date(),
      };

      await this.eventPublisher.publish(event);
    } catch (error) {
      // Log the error but don't fail the operation
      // eslint-disable-next-line no-console
      console.error('Failed to publish InvoiceCreated event:', error);
    }

    return invoice;
  }

  /**
   * Validate the input DTO.
   * @param dto - The DTO to validate
   * @throws CompositeValidationError if validation fails
   */
  private validateDto(dto: CreateInvoiceDto): void {
    const errors: Error[] = [];

    // Validate invoice number
    if (!dto.invoiceNumber || dto.invoiceNumber.trim() === '') {
      errors.push(new InvoiceValidationError('Invoice number is required'));
    }

    // Validate customer information
    if (!dto.customerId || dto.customerId.trim() === '') {
      errors.push(new InvoiceValidationError('Customer ID is required'));
    }

    if (!dto.customerName || dto.customerName.trim() === '') {
      errors.push(new InvoiceValidationError('Customer name is required'));
    }

    // Validate address
    if (!dto.customerAddress) {
      errors.push(new InvoiceValidationError('Customer address is required'));
    } else {
      if (!dto.customerAddress.street || dto.customerAddress.street.trim() === '') {
        errors.push(new InvoiceValidationError('Street address is required'));
      }
      if (!dto.customerAddress.city || dto.customerAddress.city.trim() === '') {
        errors.push(new InvoiceValidationError('City is required'));
      }
      if (!dto.customerAddress.state || dto.customerAddress.state.trim() === '') {
        errors.push(new InvoiceValidationError('State is required'));
      }
      if (!dto.customerAddress.zip || dto.customerAddress.zip.trim() === '') {
        errors.push(new InvoiceValidationError('Zip code is required'));
      }
    }

    // Validate dates
    if (!dto.invoiceDate) {
      errors.push(new InvoiceValidationError('Invoice date is required'));
    } else {
      const invoiceDate = new Date(dto.invoiceDate);
      if (isNaN(invoiceDate.getTime())) {
        errors.push(new InvoiceValidationError('Invalid invoice date format'));
      }
    }

    if (!dto.dueDate) {
      errors.push(new InvoiceValidationError('Due date is required'));
    } else {
      const dueDate = new Date(dto.dueDate);
      if (isNaN(dueDate.getTime())) {
        errors.push(new InvoiceValidationError('Invalid due date format'));
      } else if (dto.invoiceDate) {
        const invoiceDate = new Date(dto.invoiceDate);
        if (!isNaN(invoiceDate.getTime()) && dueDate < invoiceDate) {
          errors.push(
            new InvoiceValidationError('Due date must be on or after invoice date')
          );
        }
      }
    }

    // Validate items
    if (!dto.items || dto.items.length === 0) {
      errors.push(new InvoiceValidationError('At least one item is required'));
    } else {
      dto.items.forEach((item, index) => {
        if (!item.description || item.description.trim() === '') {
          errors.push(
            new InvoiceValidationError(`Item ${index + 1}: Description is required`)
          );
        }
        if (item.quantity <= 0) {
          errors.push(
            new InvoiceValidationError(
              `Item ${index + 1}: Quantity must be greater than 0`
            )
          );
        }
        if (item.unitPrice < 0) {
          errors.push(
            new InvoiceValidationError(
              `Item ${index + 1}: Unit price cannot be negative`
            )
          );
        }
      });
    }

    // Validate customer tax override if provided
    if (
      dto.customerTaxOverride !== undefined &&
      (dto.customerTaxOverride < 0 || dto.customerTaxOverride > 1)
    ) {
      errors.push(
        new InvoiceValidationError('Customer tax override must be between 0 and 1')
      );
    }

    if (errors.length > 0) {
      throw new CompositeValidationError('DTO validation failed', errors);
    }
  }
}