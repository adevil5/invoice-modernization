# Domain Implementation Patterns

This guide documents the domain-driven design patterns and implementation details used in the invoice modernization project.

## Value Objects

### Money

The Money value object ensures all financial calculations are accurate and consistent.

```typescript
// Creation patterns
const amount = new Money(19.99);
const fromCents = Money.fromCents(1999);  // $19.99
const zero = Money.zero();

// Operations
const total = price.add(tax);
const discounted = price.multiply(0.9);
const difference = total.subtract(discount);

// Validation
// - Automatically rounds to 2 decimal places
// - Prevents negative amounts (throws ValidationError)
// - Handles currency precision issues

// Conversion
money.toNumber();  // 19.99
money.toCents();   // 1999
money.toString();  // "$19.99"
```

### Address

Immutable value object for customer addresses.

```typescript
const address = new Address({
  street: "123 Main St",
  city: "Boston",
  state: "MA",      // Automatically uppercased
  zipCode: "02101"
});

// All fields are validated and required
// State codes are normalized to uppercase
// Defensive copying ensures immutability
```

### Customer

Represents customer information with optional tax override.

```typescript
const customer = new Customer({
  id: "CUST-001",
  name: "Acme Corp",
  address: address,
  taxOverrideRate: 0.0825  // Optional: 8.25% override
});

// Tax override takes precedence over state rates
// All customer data is immutable
```

### TaxRule

Encapsulates tax calculation logic.

```typescript
const taxRule = new TaxRule({
  state: "CA",
  rate: 0.0725,
  q4Adjustment: true  // October-December +2%
});

// Q4 adjustment logic
const effectiveRate = taxRule.getEffectiveRate(new Date("2024-11-15"));
// Returns 0.0925 (7.25% + 2% Q4 adjustment)
```

## Error Handling Hierarchy

### Base ValidationError

```typescript
export class ValidationError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
```

### FieldValidationError

For specific field validation failures:

```typescript
export class FieldValidationError extends ValidationError {
  constructor(
    public readonly field: string,
    message: string,
    code?: string
  ) {
    super(`${field}: ${message}`, code);
    this.name = 'FieldValidationError';
  }
}

// Usage
throw new FieldValidationError('amount', 'Must be positive', 'NEGATIVE_AMOUNT');
```

### BusinessRuleViolationError

For business rule violations with severity levels:

```typescript
export class BusinessRuleViolationError extends ValidationError {
  constructor(
    message: string,
    public readonly rule: string,
    public readonly severity: 'error' | 'warning' = 'error',
    code?: string
  ) {
    super(message, code);
    this.name = 'BusinessRuleViolationError';
  }
}

// Usage - Error
throw new BusinessRuleViolationError(
  'Invoice amount below minimum',
  'MINIMUM_AMOUNT',
  'error',
  'MIN_AMOUNT_25'
);

// Usage - Warning
new BusinessRuleViolationError(
  'Large invoice may require approval',
  'LARGE_AMOUNT',
  'warning'
);
```

### CompositeValidationError

Aggregates multiple validation errors:

```typescript
export class CompositeValidationError extends ValidationError {
  constructor(
    message: string,
    public readonly errors: ValidationError[],
    code?: string
  ) {
    super(message, code);
    this.name = 'CompositeValidationError';
  }

  hasErrors(): boolean {
    return this.errors.some(e => 
      !(e instanceof BusinessRuleViolationError) || 
      e.severity === 'error'
    );
  }

  getWarnings(): BusinessRuleViolationError[] {
    return this.errors.filter(e => 
      e instanceof BusinessRuleViolationError && 
      e.severity === 'warning'
    ) as BusinessRuleViolationError[];
  }
}
```

## Entity Patterns

### Invoice Entity

Rich domain model with business logic:

```typescript
export class Invoice {
  // Private constructor enforces creation through factory
  private constructor(private data: InvoiceData) {}

  // Factory method with validation
  static create(input: CreateInvoiceInput): Invoice {
    const errors: ValidationError[] = [];
    
    // Validate all fields
    if (!input.customerId) {
      errors.push(new FieldValidationError('customerId', 'Required'));
    }
    
    // Apply business rules
    if (totalAmount.toNumber() < 25) {
      errors.push(new BusinessRuleViolationError(
        'Invoice must be at least $25',
        'MINIMUM_AMOUNT'
      ));
    }
    
    // Throw composite error if any validation failed
    if (errors.length > 0) {
      throw new CompositeValidationError(
        'Invoice validation failed',
        errors
      );
    }
    
    return new Invoice({...});
  }

  // Business operations
  applyDiscount(rate: number): void {
    if (this.status !== InvoiceStatus.DRAFT) {
      throw new BusinessRuleViolationError(
        'Cannot modify finalized invoice',
        'INVOICE_FINALIZED'
      );
    }
    // Apply discount logic
  }
}
```

## Service Patterns

### Tax Calculation Strategy

```typescript
export class TaxCalculationService {
  private strategies: Map<string, TaxStrategy>;
  
  calculateTax(
    amount: Money,
    state: string,
    customer: Customer,
    date: Date = new Date()
  ): TaxCalculation {
    // Customer override has priority
    if (customer.taxOverrideRate !== undefined) {
      return {
        rate: customer.taxOverrideRate,
        amount: amount.multiply(customer.taxOverrideRate),
        source: 'customer_override'
      };
    }
    
    // State-based calculation with Q4 adjustment
    const strategy = this.strategies.get(state) || this.defaultStrategy;
    return strategy.calculate(amount, date);
  }
}

// State-specific strategies
class CaliforniaTaxStrategy implements TaxStrategy {
  calculate(amount: Money, date: Date): TaxCalculation {
    const baseRate = 0.0725;
    const isQ4 = date.getMonth() >= 9; // Oct-Dec
    const rate = isQ4 ? baseRate + 0.02 : baseRate;
    
    return {
      rate,
      amount: amount.multiply(rate),
      source: 'state_rate',
      q4Adjusted: isQ4
    };
  }
}
```

### Validation Service

Centralized validation with consistent error handling:

```typescript
export class ValidationService {
  validateInvoice(input: CreateInvoiceInput): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: BusinessRuleViolationError[] = [];
    
    // Collect all validation errors
    this.validateCustomer(input.customer, errors);
    this.validateLineItems(input.lineItems, errors);
    this.validateTotals(input, errors, warnings);
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      throw: () => {
        if (errors.length > 0) {
          throw new CompositeValidationError(
            'Validation failed',
            [...errors, ...warnings]
          );
        }
      }
    };
  }
}
```

## Domain Rules

### Business Invariants

1. **Minimum Invoice Amount**: $25
   - Enforced at invoice creation
   - Cannot be bypassed

2. **Bulk Discount**: 3% for 100+ items
   - Automatically applied
   - Shown as separate line item

3. **Tax Calculation**:
   - State rate (with defaults)
   - Q4 adjustment (+2% Oct-Dec)
   - Customer override (takes precedence)

4. **Invoice Status Transitions**:
   ```
   DRAFT -> PENDING -> PROCESSED
     |         |           |
     v         v           v
   CANCELLED  FAILED    ARCHIVED
   ```

### Validation Rules

1. **Money**: 
   - Non-negative
   - Max 2 decimal places
   - Valid number

2. **State Codes**:
   - 2 letter abbreviation
   - Valid US state
   - Uppercase normalized

3. **Dates**:
   - Not in future
   - Within business hours for processing

4. **Quantities**:
   - Positive integers
   - Max 999,999 per line

## Testing Patterns

### Domain Object Testing

```typescript
describe('Money', () => {
  it('should handle precision correctly', () => {
    const result = new Money(0.1).add(new Money(0.2));
    expect(result.toNumber()).toBe(0.3); // Not 0.30000000000000004
  });
  
  it('should prevent negative amounts', () => {
    expect(() => new Money(-10)).toThrow(ValidationError);
  });
});
```

### Business Rule Testing

```typescript
describe('TaxCalculation', () => {
  it('should apply Q4 adjustment', () => {
    const service = new TaxCalculationService();
    const result = service.calculateTax(
      Money.fromCents(10000),
      'CA',
      customer,
      new Date('2024-10-15')
    );
    
    expect(result.rate).toBe(0.0925); // 7.25% + 2%
    expect(result.q4Adjusted).toBe(true);
  });
});
```

### Validation Testing

```typescript
describe('ValidationService', () => {
  it('should collect multiple errors', () => {
    const result = validationService.validateInvoice({
      customerId: '', // Missing
      lineItems: [],  // Empty
      // ... other invalid data
    });
    
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toBeInstanceOf(FieldValidationError);
    expect(result.errors[0].field).toBe('customerId');
  });
});
```

## Legacy Compatibility

### CSV Format Preservation

```typescript
// Legacy CSV columns (exact order)
const LEGACY_COLUMNS = [
  'invoice_id',
  'customer_name',
  'customer_address',
  'customer_city',
  'customer_state',
  'customer_zip',
  'item_description',
  'quantity',
  'unit_price',
  'total_amount',
  'tax_amount',
  'grand_total',
  'invoice_date'
];

// Maintain exact formatting
function formatForLegacy(invoice: Invoice): string[] {
  return [
    invoice.id,
    invoice.customer.name,
    invoice.customer.address.street,
    invoice.customer.address.city,
    invoice.customer.address.state, // Already uppercase
    invoice.customer.address.zipCode,
    // ... etc
  ];
}
```

### Business Rule Parity

```typescript
// Legacy Python behavior
def calculate_tax(amount, state, is_q4):
    base_rate = STATE_RATES.get(state, 0.05)  # 5% default
    if is_q4:
        base_rate += 0.02
    return amount * base_rate

// Modern TypeScript equivalent
calculateTax(amount: Money, state: string, date: Date): Money {
  const baseRate = this.stateRates.get(state) ?? 0.05;
  const isQ4 = date.getMonth() >= 9;
  const effectiveRate = isQ4 ? baseRate + 0.02 : baseRate;
  return amount.multiply(effectiveRate);
}
```