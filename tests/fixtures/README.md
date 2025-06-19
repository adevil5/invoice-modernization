# Test Fixtures

This directory contains CSV files and test data based on actual production samples from the legacy invoice processing system.

## Fixture Files

### standard-format.csv
- Standard comma-separated format
- Clean data with proper formatting
- Multiple line items using pipe delimiter
- Various states and amounts

### semicolon-delimited.csv
- Alternative delimiter format (semicolon)
- ISO date formats (YYYY-MM-DD)
- European-style data

### problematic-data.csv
- Real-world data quality issues
- Missing customer IDs
- Extra spaces in fields
- Invalid amounts ("not_a_number")
- Empty items field
- Lowercase state codes
- Short year format

### edge-cases.csv
- Tax-exempt customer (CUST001)
- International characters
- Zero and negative amounts
- Below minimum threshold amounts
- Decimal quantities
- Commas in item names
- Multiple invoices same customer/date
- Various state name formats

### date-format-variations.csv
- MM/DD/YYYY (US standard)
- YYYY-MM-DD (ISO format)
- MM-DD-YYYY (dash separated)
- M/D/YY (short format)
- DD/MM/YYYY (European format)
- Text month format (legacy system should fail)

### late-fee-scenarios.csv
- Various past due scenarios
- Testing 1, 3, 6, and 12 months late
- For calculating late fee accumulation

### utf8-special-chars.csv
- French accents (é, ç)
- German umlauts (ü, ö, ß)
- Spanish characters (ñ, á)
- Chinese characters
- Cyrillic characters
- Tests UTF-8 encoding handling

### expected-outputs.json
- Documents expected calculations for key test cases
- Tax rate applications
- Bulk discount calculations
- Late fee scenarios
- Edge case behaviors
- Reference for validating parity with legacy system

## Usage

These fixtures are used in:
- `tests/unit/legacy/legacy-parity.test.ts` - For testing business logic parity
- Integration tests - For testing CSV parsing
- E2E tests - For testing complete invoice processing flow

## Notes

- All amounts should be rounded to 2 decimal places
- PDF filenames follow format: `{CUSTOMER_ID}_{INVOICE_DATE}_{TOTAL}.pdf`
- Date in filename should be YYYY-MM-DD format regardless of input format
- Legacy system has various undocumented behaviors captured in these fixtures