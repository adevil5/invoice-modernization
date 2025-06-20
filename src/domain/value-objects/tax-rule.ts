import { Money } from './money';

export class TaxRule {
  constructor(
    public readonly rate: number,
    public readonly description: string
  ) {
    this.validate();
  }

  private validate(): void {
    if (this.rate < 0) {
      throw new Error('Tax rate cannot be negative');
    }
    if (this.rate > 1) {
      throw new Error('Tax rate cannot exceed 100%');
    }
  }

  apply(amount: Money): Money {
    const taxCents = Math.round(amount.toCents() * this.rate);
    return Money.fromCents(taxCents);
  }

  withAddedRate(additionalRate: number): TaxRule {
    return new TaxRule(
      this.rate + additionalRate,
      `${this.description} (with adjustment)`
    );
  }

  equals(other: TaxRule): boolean {
    return this.rate === other.rate && this.description === other.description;
  }
}