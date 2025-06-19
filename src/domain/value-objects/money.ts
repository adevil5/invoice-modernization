export class Money {
  private readonly amount: number;
  
  constructor(amount: number) {
    if (amount < 0) {
      throw new Error('Money amount cannot be negative');
    }
    // Round to 2 decimal places using "round half up" method
    this.amount = Math.round(amount * 100) / 100;
  }
  
  static fromCents(cents: number): Money {
    return new Money(cents / 100);
  }
  
  getAmount(): number {
    return this.amount;
  }
  
  toCents(): number {
    return Math.round(this.amount * 100);
  }
  
  add(other: Money): Money {
    return new Money(this.amount + other.amount);
  }
  
  subtract(other: Money): Money {
    return new Money(this.amount - other.amount);
  }
  
  multiply(multiplier: number): Money {
    return new Money(this.amount * multiplier);
  }
  
  equals(other: Money): boolean {
    return this.amount === other.amount;
  }
  
  isGreaterThanOrEqual(other: Money): boolean {
    return this.amount >= other.amount;
  }
  
  isLessThan(other: Money): boolean {
    return this.amount < other.amount;
  }
  
  toString(): string {
    return `$${this.amount.toFixed(2)}`;
  }
}