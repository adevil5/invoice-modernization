import type { Address } from './address';

export class Customer {
  constructor(
    private readonly id: string,
    private readonly name: string,
    private readonly address: Address
  ) {
    if (!id?.trim()) {
      throw new Error('Customer ID is required');
    }
    if (!name?.trim()) {
      throw new Error('Customer name is required');
    }
    if (!address) {
      throw new Error('Customer address is required');
    }
  }
  
  getId(): string {
    return this.id;
  }
  
  getName(): string {
    return this.name;
  }
  
  getAddress(): Address {
    return this.address;
  }
  
  isTaxExempt(): boolean {
    // Based on legacy analysis, CUST001 is tax exempt
    return this.id === 'CUST001';
  }
  
  equals(other: Customer): boolean {
    return (
      this.id === other.id &&
      this.name === other.name &&
      this.address.equals(other.address)
    );
  }
}