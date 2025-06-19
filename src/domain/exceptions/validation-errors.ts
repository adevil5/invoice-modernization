export abstract class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class FieldValidationError extends ValidationError {
  constructor(
    public readonly field: string,
    message: string,
    public readonly value?: unknown
  ) {
    super(message);
    this.name = 'FieldValidationError';
    Object.setPrototypeOf(this, FieldValidationError.prototype);
  }
}

export class BusinessRuleViolationError extends ValidationError {
  constructor(
    public readonly rule: string,
    message: string,
    public readonly severity: 'error' | 'warning' = 'error',
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BusinessRuleViolationError';
    Object.setPrototypeOf(this, BusinessRuleViolationError.prototype);
  }
}

export class CompositeValidationError extends ValidationError {
  constructor(
    message: string,
    public readonly errors: ValidationError[]
  ) {
    super(message);
    this.name = 'CompositeValidationError';
    Object.setPrototypeOf(this, CompositeValidationError.prototype);
  }

  hasErrors(): boolean {
    return this.errors.some(e => 
      e instanceof BusinessRuleViolationError ? e.severity === 'error' : true
    );
  }

  hasWarnings(): boolean {
    return this.errors.some(e => 
      e instanceof BusinessRuleViolationError && e.severity === 'warning'
    );
  }

  getErrors(): ValidationError[] {
    return this.errors.filter(e => 
      e instanceof BusinessRuleViolationError ? e.severity === 'error' : true
    );
  }

  getWarnings(): BusinessRuleViolationError[] {
    return this.errors.filter(e => 
      e instanceof BusinessRuleViolationError && e.severity === 'warning'
    ) as BusinessRuleViolationError[];
  }
}