import { describe, expect, test } from '@jest/globals';

interface LegacyInvoiceInput {
  customer_id: string;
  customer_name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  amount: string;
  invoice_date: string;
  due_date: string;
  items: string;
}

interface LegacyInvoiceOutput {
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  lateFee: number;
  total: number;
  pdfFilename: string;
}

describe('Legacy Invoice Processing - Parity Tests', () => {
  describe('Tax Calculation Rules', () => {
    test('should apply 0% tax for nonprofit customer CUST001', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST001',
        customer_name: 'Nonprofit Org',
        address: '123 Main St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '1000.00',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024',
        items: 'Service:1:1000'
      };
      
      const expected = {
        subtotal: 1000.00,
        discount: 0,
        taxRate: 0,
        taxAmount: 0,
        lateFee: 0,
        total: 1000.00
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.taxRate).toBe(expected.taxRate);
      expect(result.total).toBe(expected.total);
    });

    test('should apply CA state tax rate of 7.25%', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST002',
        customer_name: 'Tech Corp',
        address: '456 Market St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '1000.00',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024',
        items: 'Software License:1:1000'
      };
      
      const expected = {
        subtotal: 1000.00,
        discount: 0,
        taxRate: 0.0725,
        taxAmount: 72.50,
        lateFee: 0,
        total: 1072.50
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.taxRate).toBe(expected.taxRate);
      expect(result.taxAmount).toBe(expected.taxAmount);
      expect(result.total).toBe(expected.total);
    });

    test('should apply NY state tax rate of 8%', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST003',
        customer_name: 'Finance LLC',
        address: '789 Wall St',
        city: 'New York',
        state: 'NY',
        zip: '10005',
        amount: '1000.00',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024',
        items: 'Consulting:10:100'
      };
      
      const expected = {
        subtotal: 1000.00,
        discount: 0,
        taxRate: 0.08,
        taxAmount: 80.00,
        lateFee: 0,
        total: 1080.00
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.taxRate).toBe(expected.taxRate);
      expect(result.total).toBe(expected.total);
    });

    test('should apply TX state tax rate of 6.25%', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST004',
        customer_name: 'Oil Services Inc',
        address: '321 Houston St',
        city: 'Houston',
        state: 'TX',
        zip: '77001',
        amount: '1000.00',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024',
        items: 'Equipment:1:1000'
      };
      
      const expected = {
        taxRate: 0.0625,
        taxAmount: 62.50,
        total: 1062.50
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.taxRate).toBe(expected.taxRate);
      expect(result.total).toBe(expected.total);
    });

    test('should apply default 5% tax for unknown states', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST005',
        customer_name: 'Random Corp',
        address: '123 Unknown St',
        city: 'Somewhere',
        state: 'XX',
        zip: '00000',
        amount: '1000.00',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024',
        items: 'Service:1:1000'
      };
      
      const expected = {
        taxRate: 0.05,
        taxAmount: 50.00,
        total: 1050.00
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.taxRate).toBe(expected.taxRate);
      expect(result.total).toBe(expected.total);
    });

    test('should apply Q4 2% tax increase for October invoices', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST006',
        customer_name: 'Q4 Company',
        address: '456 Fall St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '1000.00',
        invoice_date: '10/15/2024',
        due_date: '11/14/2024',
        items: 'Q4 Service:1:1000'
      };
      
      const expected = {
        taxRate: 0.0925, // 7.25% + 2%
        taxAmount: 92.50,
        total: 1092.50
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.taxRate).toBe(expected.taxRate);
      expect(result.total).toBe(expected.total);
    });

    test('should apply Q4 tax increase for November', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST007',
        customer_name: 'November Corp',
        address: '789 Autumn Ave',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        amount: '1000.00',
        invoice_date: '11/01/2024',
        due_date: '12/01/2024',
        items: 'Monthly Service:1:1000'
      };
      
      const expected = {
        taxRate: 0.10, // 8% + 2%
        taxAmount: 100.00,
        total: 1100.00
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.taxRate).toBe(expected.taxRate);
      expect(result.total).toBe(expected.total);
    });

    test('should apply Q4 tax increase for December', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST008',
        customer_name: 'December Inc',
        address: '321 Winter Way',
        city: 'Houston',
        state: 'TX',
        zip: '77001',
        amount: '1000.00',
        invoice_date: '12/15/2024',
        due_date: '01/14/2025',
        items: 'Year End Service:1:1000'
      };
      
      const expected = {
        taxRate: 0.0825, // 6.25% + 2%
        taxAmount: 82.50,
        total: 1082.50
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.taxRate).toBe(expected.taxRate);
      expect(result.total).toBe(expected.total);
    });
  });

  describe('Bulk Discount Rules', () => {
    test('should apply 3% discount for amounts >= $10,000', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST009',
        customer_name: 'Big Buyer Corp',
        address: '999 Large St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '10000.00',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024',
        items: 'Bulk Order:100:100'
      };
      
      const expected = {
        subtotal: 10000.00,
        discount: 300.00, // 3% of 10000
        taxableAmount: 9700.00, // 10000 - 300
        taxRate: 0.0725,
        taxAmount: 703.25, // 7.25% of 9700
        total: 10403.25 // 9700 + 703.25
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.discount).toBe(expected.discount);
      expect(result.taxAmount).toBe(expected.taxAmount);
      expect(result.total).toBe(expected.total);
    });

    test('should not apply discount for amounts < $10,000', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST010',
        customer_name: 'Regular Buyer',
        address: '100 Normal St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '9999.99',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024',
        items: 'Regular Order:99:101.01'
      };
      
      const expected = {
        subtotal: 9999.99,
        discount: 0,
        taxAmount: 725.00, // 7.25% of 9999.99
        total: 10724.99
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.discount).toBe(expected.discount);
      expect(result.total).toBe(expected.total);
    });

    test('should apply discount before tax in Q4', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST011',
        customer_name: 'Q4 Bulk Buyer',
        address: '555 October Ave',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '15000.00',
        invoice_date: '10/15/2024',
        due_date: '11/14/2024',
        items: 'Q4 Bulk:150:100'
      };
      
      const expected = {
        subtotal: 15000.00,
        discount: 450.00, // 3% of 15000
        taxableAmount: 14550.00,
        taxRate: 0.0925, // 7.25% + 2% Q4
        taxAmount: 1345.88, // 9.25% of 14550
        total: 15895.88
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.discount).toBe(expected.discount);
      expect(result.taxRate).toBe(expected.taxRate);
      expect(result.taxAmount).toBe(expected.taxAmount);
      expect(result.total).toBe(expected.total);
    });
  });

  describe('Late Fee Calculation', () => {
    test('should not apply late fee within 30 days', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST012',
        customer_name: 'On Time Payer',
        address: '123 Prompt St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '1000.00',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024', // 30 days later
        items: 'Service:1:1000'
      };
      
      const currentDate = new Date('2024-02-14'); // Due date
      const expected = {
        lateFee: 0,
        total: 1072.50 // 1000 + 72.50 tax
      };
      
      const result = calculateLegacyInvoice(input, currentDate);
      expect(result.lateFee).toBe(expected.lateFee);
      expect(result.total).toBe(expected.total);
    });

    test('should apply 1.5% late fee per month after 30 days', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST013',
        customer_name: 'Late Payer',
        address: '456 Delay Dr',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '1000.00',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024',
        items: 'Service:1:1000'
      };
      
      const currentDate = new Date('2024-03-16'); // 31 days after due date
      const baseTotal = 1072.50; // 1000 + 72.50 tax
      const expected = {
        lateFee: 16.09, // 1.5% of 1072.50
        total: 1088.59 // 1072.50 + 16.09
      };
      
      const result = calculateLegacyInvoice(input, currentDate);
      expect(result.lateFee).toBe(expected.lateFee);
      expect(result.total).toBe(expected.total);
    });

    test('should calculate multiple months of late fees', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST014',
        customer_name: 'Very Late Corp',
        address: '789 Overdue Ave',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '1000.00',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024',
        items: 'Service:1:1000'
      };
      
      const currentDate = new Date('2024-05-16'); // 91 days after due date (3 months)
      const baseTotal = 1072.50;
      const expected = {
        lateFee: 48.26, // 1.5% * 3 months = 4.5% of 1072.50
        total: 1120.76
      };
      
      const result = calculateLegacyInvoice(input, currentDate);
      expect(result.lateFee).toBe(expected.lateFee);
      expect(result.total).toBe(expected.total);
    });
  });

  describe('Date Format Handling', () => {
    test('should handle MM/DD/YYYY format', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST015',
        customer_name: 'Date Test 1',
        address: '123 Format St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '1000.00',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024',
        items: 'Service:1:1000'
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.pdfFilename).toBe('CUST015_2024-01-15_1072.50.pdf');
    });

    test('should handle YYYY-MM-DD format', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST016',
        customer_name: 'Date Test 2',
        address: '456 ISO St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '1000.00',
        invoice_date: '2024-01-15',
        due_date: '2024-02-14',
        items: 'Service:1:1000'
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.pdfFilename).toBe('CUST016_2024-01-15_1072.50.pdf');
    });

    test('should handle MM-DD-YYYY format', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST017',
        customer_name: 'Date Test 3',
        address: '789 Dash Dr',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '1000.00',
        invoice_date: '01-15-2024',
        due_date: '02-14-2024',
        items: 'Service:1:1000'
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.pdfFilename).toBe('CUST017_2024-01-15_1072.50.pdf');
    });
  });

  describe('PDF Filename Generation', () => {
    test('should generate correct filename format', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST018',
        customer_name: 'PDF Test',
        address: '111 File St',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '1234.56',
        invoice_date: '03/15/2024',
        due_date: '04/14/2024',
        items: 'Service:1:1234.56'
      };
      
      const expected = 'CUST018_2024-03-15_1324.06.pdf'; // 1234.56 + 89.51 tax
      
      const result = calculateLegacyInvoice(input);
      expect(result.pdfFilename).toBe(expected);
    });

    test('should round total to 2 decimal places in filename', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST019',
        customer_name: 'Rounding Test',
        address: '222 Round Rd',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '999.999',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024',
        items: 'Service:1:999.999'
      };
      
      const expected = 'CUST019_2024-01-15_1072.50.pdf'; // Properly rounded
      
      const result = calculateLegacyInvoice(input);
      expect(result.pdfFilename).toBe(expected);
    });
  });

  describe('Rounding Rules', () => {
    test('should round all amounts to 2 decimal places', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST020',
        customer_name: 'Precision Test',
        address: '333 Decimal Dr',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '999.996',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024',
        items: 'Service:1:999.996'
      };
      
      const expected = {
        subtotal: 1000.00, // Rounded from 999.996
        taxAmount: 72.50, // 7.25% of 1000
        total: 1072.50
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.subtotal).toBe(expected.subtotal);
      expect(result.taxAmount).toBe(expected.taxAmount);
      expect(result.total).toBe(expected.total);
    });
  });

  describe('State Code Variations', () => {
    test('should handle lowercase state codes', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST021',
        customer_name: 'Lowercase State',
        address: '444 Lower St',
        city: 'San Francisco',
        state: 'ca',
        zip: '94105',
        amount: '1000.00',
        invoice_date: '01/15/2024',
        due_date: '02/14/2024',
        items: 'Service:1:1000'
      };
      
      const expected = {
        taxRate: 0.0725,
        total: 1072.50
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.taxRate).toBe(expected.taxRate);
      expect(result.total).toBe(expected.total);
    });

    test('should handle full state names', () => {
      const states = [
        { full: 'California', code: 'CA', rate: 0.0725 },
        { full: 'New York', code: 'NY', rate: 0.08 },
        { full: 'Texas', code: 'TX', rate: 0.0625 }
      ];

      states.forEach(state => {
        const input: LegacyInvoiceInput = {
          customer_id: `CUST-${state.code}`,
          customer_name: `${state.full} Test`,
          address: '555 Full Name St',
          city: 'Test City',
          state: state.full,
          zip: '12345',
          amount: '1000.00',
          invoice_date: '01/15/2024',
          due_date: '02/14/2024',
          items: 'Service:1:1000'
        };
        
        const result = calculateLegacyInvoice(input);
        expect(result.taxRate).toBe(state.rate);
      });
    });
  });

  describe('Complex Combined Scenarios', () => {
    test('should handle nonprofit in Q4 with bulk discount', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST001', // Nonprofit
        customer_name: 'Nonprofit Org',
        address: '666 Complex Ct',
        city: 'San Francisco',
        state: 'CA',
        zip: '94105',
        amount: '20000.00',
        invoice_date: '11/15/2024', // Q4
        due_date: '12/15/2024',
        items: 'Bulk Service:200:100'
      };
      
      const expected = {
        subtotal: 20000.00,
        discount: 600.00, // 3% bulk discount
        taxableAmount: 19400.00,
        taxRate: 0, // Nonprofit override (ignores Q4 increase)
        taxAmount: 0,
        lateFee: 0,
        total: 19400.00
      };
      
      const result = calculateLegacyInvoice(input);
      expect(result.discount).toBe(expected.discount);
      expect(result.taxRate).toBe(expected.taxRate);
      expect(result.total).toBe(expected.total);
    });

    test('should handle bulk discount + Q4 tax + late fee', () => {
      const input: LegacyInvoiceInput = {
        customer_id: 'CUST022',
        customer_name: 'Complex Scenario Corp',
        address: '777 Triple St',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        amount: '15000.00',
        invoice_date: '10/01/2024',
        due_date: '10/31/2024',
        items: 'Complex Order:150:100'
      };
      
      const currentDate = new Date('2024-12-02'); // 32 days late
      const expected = {
        subtotal: 15000.00,
        discount: 450.00, // 3% bulk
        taxableAmount: 14550.00,
        taxRate: 0.10, // 8% NY + 2% Q4
        taxAmount: 1455.00,
        baseTotal: 16005.00, // 14550 + 1455
        lateFee: 240.08, // 1.5% of 16005
        total: 16245.08
      };
      
      const result = calculateLegacyInvoice(input, currentDate);
      expect(result.discount).toBe(expected.discount);
      expect(result.taxRate).toBe(expected.taxRate);
      expect(result.taxAmount).toBe(expected.taxAmount);
      expect(result.lateFee).toBe(expected.lateFee);
      expect(result.total).toBe(expected.total);
    });
  });
});

// Placeholder function - will be replaced with actual implementation
function calculateLegacyInvoice(
  input: LegacyInvoiceInput, 
  currentDate?: Date
): LegacyInvoiceOutput {
  // This function will be implemented in the domain layer
  // For now, returning a mock to show test structure
  throw new Error('Not implemented - replace with actual domain logic');
}