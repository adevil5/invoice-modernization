export function createMockInvoice(overrides = {}): Record<string, unknown> {
  return {
    id: 'test-invoice-123',
    customerName: 'Test Customer',
    customerEmail: 'test@example.com',
    items: [
      {
        description: 'Test Product',
        quantity: 1,
        unitPrice: 100.0,
        total: 100.0,
      },
    ],
    subtotal: 100.0,
    tax: 10.0,
    total: 110.0,
    status: 'pending',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function createMockTaxRule(overrides = {}): Record<string, unknown> {
  return {
    id: 'tax-rule-1',
    name: 'Standard Tax',
    rate: 0.1,
    applicableStates: ['CA', 'NY'],
    ...overrides,
  };
}

export function waitForAsync(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function mockLogger(): Record<string, jest.Mock> {
  return {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  };
}
