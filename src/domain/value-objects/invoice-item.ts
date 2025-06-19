import type { Money } from './money.js';

export class InvoiceItem {
  constructor(
    private readonly description: string,
    private readonly quantity: number,
    private readonly unitPrice: Money
  ) {
    if (!description?.trim()) {
      throw new Error('Item description is required');
    }
    if (quantity <= 0) {
      throw new Error('Item quantity must be greater than zero');
    }
    if (!unitPrice) {
      throw new Error('Unit price is required');
    }
  }
  
  getDescription(): string {
    return this.description;
  }
  
  getQuantity(): number {
    return this.quantity;
  }
  
  getUnitPrice(): Money {
    return this.unitPrice;
  }
  
  getTotal(): Money {
    return this.unitPrice.multiply(this.quantity);
  }
  
  equals(other: InvoiceItem): boolean {
    return (
      this.description === other.description &&
      this.quantity === other.quantity &&
      this.unitPrice.equals(other.unitPrice)
    );
  }
}