import { createMockInvoice } from '../helpers/test-utils';

describe('Jest Setup Verification', () => {
  it('should run a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should use test helpers', () => {
    const mockInvoice = createMockInvoice();
    expect(mockInvoice.id).toBe('test-invoice-123');
    expect(mockInvoice.total).toBe(110.0);
  });

  it('should have test environment variables set', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.AWS_REGION).toBe('us-east-1');
    expect(process.env.DYNAMODB_TABLE_NAME).toBe('test-invoices');
  });
});
