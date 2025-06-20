import type { Money } from '../value-objects/money';
import { TaxRule } from '../value-objects/tax-rule';

export class TaxCalculator {
  private readonly stateTaxRates: Map<string, number> = new Map([
    ['CA', 0.0725],
    ['NY', 0.0800],
    ['TX', 0.0625],
    ['IL', 0.0625],
    ['PA', 0.0600],
    ['NV', 0.0685],
    ['WA', 0.0650],
    ['FL', 0.0600],
    ['OH', 0.0575],
    ['AZ', 0.0560],
  ]);

  private readonly customerOverrides: Map<string, number> = new Map([
    ['CUST001', 0.0000], // Tax-exempt nonprofit
  ]);

  private readonly defaultTaxRate = 0.05;
  private readonly q4Adjustment = 0.02;

  calculateTax(subtotal: Money, state: string, customerId: string, invoiceDate: Date): Money {
    // Normalize state code to uppercase
    const normalizedState = state.toUpperCase();
    
    // Get base tax rule
    const taxRule = this.getTaxRule(normalizedState, customerId, invoiceDate);
    
    // Apply tax rule to subtotal
    return taxRule.apply(subtotal);
  }

  private getTaxRule(state: string, customerId: string, invoiceDate: Date): TaxRule {
    // Check for customer override first (highest priority)
    const customerRate = this.customerOverrides.get(customerId);
    if (customerRate !== undefined) {
      return new TaxRule(customerRate, `Customer Override (${customerId})`);
    }

    // Get base state rate or default
    const baseRate = this.stateTaxRates.get(state) ?? this.defaultTaxRate;
    let description = state && this.stateTaxRates.has(state) 
      ? `${state} Sales Tax` 
      : 'Default Sales Tax';

    // Check if Q4 adjustment applies
    if (this.isQ4(invoiceDate)) {
      const adjustedRate = baseRate + this.q4Adjustment;
      description += ' + Q4 Adjustment';
      return new TaxRule(adjustedRate, description);
    }

    return new TaxRule(baseRate, description);
  }

  private isQ4(date: Date): boolean {
    const month = date.getMonth(); // 0-indexed (0 = January, 11 = December)
    return month >= 9 && month <= 11; // October (9), November (10), December (11)
  }
}