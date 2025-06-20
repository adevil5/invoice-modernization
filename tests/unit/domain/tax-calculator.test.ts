import { describe, expect, it } from '@jest/globals';
import { TaxCalculator } from '../../../src/domain/services/tax-calculator';
import { TaxRule } from '../../../src/domain/value-objects/tax-rule';
import { Money } from '../../../src/domain/value-objects/money';

describe('TaxCalculator', () => {
  describe('Basic Tax Calculation', () => {
    it('should calculate tax with default rate when no specific rules apply', () => {
      const calculator = new TaxCalculator();
      const subtotal = Money.fromCents(10000); // $100.00
      const tax = calculator.calculateTax(subtotal, 'Unknown State', 'CUST999', new Date(2024, 0, 15));
      
      expect(tax.toCents()).toBe(500); // 5% of $100 = $5.00
    });

    it('should apply state-specific tax rates', () => {
      const calculator = new TaxCalculator();
      const subtotal = Money.fromCents(10000); // $100.00
      
      // Test California rate
      const caTax = calculator.calculateTax(subtotal, 'CA', 'CUST999', new Date(2024, 0, 15));
      expect(caTax.toCents()).toBe(725); // 7.25% of $100 = $7.25
      
      // Test New York rate
      const nyTax = calculator.calculateTax(subtotal, 'NY', 'CUST999', new Date(2024, 0, 15));
      expect(nyTax.toCents()).toBe(800); // 8.00% of $100 = $8.00
      
      // Test Texas rate
      const txTax = calculator.calculateTax(subtotal, 'TX', 'CUST999', new Date(2024, 0, 15));
      expect(txTax.toCents()).toBe(625); // 6.25% of $100 = $6.25
    });

    it('should handle state code case insensitivity', () => {
      const calculator = new TaxCalculator();
      const subtotal = Money.fromCents(10000); // $100.00
      
      const upperCase = calculator.calculateTax(subtotal, 'CA', 'CUST999', new Date(2024, 0, 15));
      const lowerCase = calculator.calculateTax(subtotal, 'ca', 'CUST999', new Date(2024, 0, 15));
      
      expect(upperCase.toCents()).toBe(lowerCase.toCents());
    });
  });

  describe('Customer-Specific Overrides', () => {
    it('should apply customer-specific tax rate override', () => {
      const calculator = new TaxCalculator();
      const subtotal = Money.fromCents(10000); // $100.00
      
      // CUST001 is tax-exempt
      const tax = calculator.calculateTax(subtotal, 'CA', 'CUST001', new Date(2024, 0, 15));
      expect(tax.toCents()).toBe(0); // 0% tax for nonprofit
    });

    it('should prioritize customer override over state rate', () => {
      const calculator = new TaxCalculator();
      const subtotal = Money.fromCents(10000); // $100.00
      
      // Even in high-tax NY, CUST001 pays 0%
      const tax = calculator.calculateTax(subtotal, 'NY', 'CUST001', new Date(2024, 0, 15));
      expect(tax.toCents()).toBe(0);
    });
  });

  describe('Q4 Tax Adjustment', () => {
    it('should add 2% Q4 adjustment for dates in Q4', () => {
      const calculator = new TaxCalculator();
      const subtotal = Money.fromCents(10000); // $100.00
      
      // October 1st - should have Q4 adjustment
      const oct1Tax = calculator.calculateTax(subtotal, 'CA', 'CUST999', new Date(2024, 9, 1)); // Month is 0-indexed
      expect(oct1Tax.toCents()).toBe(925); // 7.25% + 2% = 9.25% of $100 = $9.25
      
      // December 31st - should have Q4 adjustment
      const dec31Tax = calculator.calculateTax(subtotal, 'CA', 'CUST999', new Date(2024, 11, 31));
      expect(dec31Tax.toCents()).toBe(925); // 7.25% + 2% = 9.25% of $100 = $9.25
    });

    it('should not add Q4 adjustment for dates outside Q4', () => {
      const calculator = new TaxCalculator();
      const subtotal = Money.fromCents(10000); // $100.00
      
      // September 30th - no Q4 adjustment
      const sep30Tax = calculator.calculateTax(subtotal, 'CA', 'CUST999', new Date(2024, 8, 30)); // Month is 0-indexed
      expect(sep30Tax.toCents()).toBe(725); // 7.25% of $100 = $7.25
      
      // January 1st - no Q4 adjustment
      const jan1Tax = calculator.calculateTax(subtotal, 'CA', 'CUST999', new Date(2024, 0, 1)); // Month is 0-indexed
      expect(jan1Tax.toCents()).toBe(725); // 7.25% of $100 = $7.25
    });

    it('should not apply Q4 adjustment to tax-exempt customers', () => {
      const calculator = new TaxCalculator();
      const subtotal = Money.fromCents(10000); // $100.00
      
      // Even in Q4, tax-exempt customers pay 0%
      const tax = calculator.calculateTax(subtotal, 'CA', 'CUST001', new Date(2024, 10, 15));
      expect(tax.toCents()).toBe(0);
    });
  });

  describe('All State Rates', () => {
    it('should correctly apply all documented state tax rates', () => {
      const calculator = new TaxCalculator();
      const subtotal = Money.fromCents(10000); // $100.00
      const date = new Date(2024, 0, 15); // Not Q4
      
      const stateTaxRates = [
        { state: 'CA', expectedCents: 725 }, // 7.25%
        { state: 'NY', expectedCents: 800 }, // 8.00%
        { state: 'TX', expectedCents: 625 }, // 6.25%
        { state: 'IL', expectedCents: 625 }, // 6.25%
        { state: 'PA', expectedCents: 600 }, // 6.00%
        { state: 'NV', expectedCents: 685 }, // 6.85%
        { state: 'WA', expectedCents: 650 }, // 6.50%
        { state: 'FL', expectedCents: 600 }, // 6.00%
        { state: 'OH', expectedCents: 575 }, // 5.75%
        { state: 'AZ', expectedCents: 560 }, // 5.60%
      ];
      
      stateTaxRates.forEach(({ state, expectedCents }) => {
        const tax = calculator.calculateTax(subtotal, state, 'CUST999', date);
        expect(tax.toCents()).toBe(expectedCents);
      });
    });
  });

  describe('Tax Rule Value Object', () => {
    it('should create tax rule with valid rate', () => {
      const rule = new TaxRule(0.0725, 'California Sales Tax');
      expect(rule.rate).toBe(0.0725);
      expect(rule.description).toBe('California Sales Tax');
    });

    it('should throw error for negative tax rate', () => {
      expect(() => new TaxRule(-0.05, 'Invalid')).toThrow('Tax rate cannot be negative');
    });

    it('should throw error for tax rate over 100%', () => {
      expect(() => new TaxRule(1.5, 'Invalid')).toThrow('Tax rate cannot exceed 100%');
    });

    it('should calculate tax amount correctly', () => {
      const rule = new TaxRule(0.08, 'NY Sales Tax');
      const subtotal = Money.fromCents(5000); // $50.00
      const tax = rule.apply(subtotal);
      expect(tax.toCents()).toBe(400); // 8% of $50 = $4.00
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero subtotal', () => {
      const calculator = new TaxCalculator();
      const subtotal = Money.fromCents(0);
      const tax = calculator.calculateTax(subtotal, 'CA', 'CUST999', new Date(2024, 0, 15));
      expect(tax.toCents()).toBe(0);
    });

    it('should round tax amounts correctly', () => {
      const calculator = new TaxCalculator();
      // $33.33 * 7.25% = $2.416425, should round to $2.42
      const subtotal = Money.fromCents(3333);
      const tax = calculator.calculateTax(subtotal, 'CA', 'CUST999', new Date(2024, 0, 15));
      expect(tax.toCents()).toBe(242);
    });
  });
});