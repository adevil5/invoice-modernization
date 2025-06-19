# Sample CSV Files and Production Data

## Sample CSV File 1: standard_format.csv
```csv
customer_id,customer_name,address,city,state,zip,amount,invoice_date,due_date,items
CUST001,Nonprofit Foundation,123 Charity Lane,Boston,MA,02101,5000.00,01/15/2025,02/15/2025,Consulting:40:125.00
CUST447,Tech Startup Inc,456 Innovation Blvd,Austin,TX,78701,15750.00,01/10/2025,02/10/2025,Development:100:150.00|Support:5:75.00
CUST892,Global Enterprises,789 Corporate Dr,San Francisco,CA,94105,8500.00,12/20/2024,01/20/2025,License:1:8500.00
CUST555,Small Business LLC,321 Main St,Seattle,WA,98101,2500.00,01/05/2025,02/05/2025,Widget A:10:200.00|Widget B:5:100.00
```

## Sample CSV File 2: semicolon_delimited.csv
```csv
customer_id;customer_name;address;city;state;zip;amount;invoice_date;due_date;items
CUST999;European Client GmbH;Hauptstraße 10;Munich;BY;80331;12000.00;2025-01-12;2025-02-12;Service:1:12000.00
CUST888;Another Company;55 Fifth Ave;New York;NY;10003;3200.00;01-08-2025;02-08-2025;Product X:20:160.00
```

## Sample CSV File 3: problematic_data.csv
```csv
customer_id,customer_name,address,city,state,zip,amount,invoice_date,due_date,items
CUST777,Messy Data Corp,999 Error St,Chicago,il,60601,24.99,1/5/25,2/5/25,
CUST666,  Spaces Everywhere  ,  123 Space Rd  ,Denver,CO  ,80202,10500,01/01/2025,01/31/2025,Item One:1:10500
,Missing ID Company,456 No ID Lane,Miami,FL,33101,500.00,01/10/2025,02/10/2025,Service:1:500.00
CUST444,Normal Co,789 Fine St,Portland,OR,97201,not_a_number,01/15/2025,02/15/2025,Good:1:100.00
```

## Sample Error Log: /var/log/invoice_errors.log
```
[2024-12-15 09:32:15] Parse error in /mnt/finance_share/invoices/pending/batch_20241215.csv row 47: could not convert string to float: 'N/A'
[2024-12-18 14:22:31] Cannot read file /mnt/finance_share/invoices/pending/corrupted.csv: 'utf8' codec can't decode byte 0xff in position 0: invalid start byte
[2024-12-20 11:45:22] Late fee calculation error: day is out of range for month
[2025-01-02 16:33:10] PDF generation failed: [Errno 28] No space left on device
[2025-01-05 08:15:43] Processing failed for customer CUST332: float() argument must be a string or a number
[2025-01-08 10:22:17] Parse error in /mnt/finance_share/invoices/pending/january_batch.csv row 112: list index out of range
[2025-01-10 13:55:41] Cannot parse date 'Jan 10, 2025'
[2025-01-12 09:18:22] Processing failed for customer CUST998: 'NoneType' object has no attribute 'split'
```

## Known Production Issues (from Team)

### From Alex (Tech Lead):
"Here are the main issues we've documented:
1. **Date Format Chaos**: We've seen at least 5 different date formats. Some European customers use DD/MM/YYYY which breaks everything
2. **State Code Issues**: Sometimes lowercase, sometimes full state names ('California' instead of 'CA')
3. **Memory Issues**: Script crashes on files > 10MB (about 50k rows)
4. **Special Characters**: UTF-8 issues with international customer names break PDF generation
5. **Network Share**: If the mount is down, script just hangs forever
6. **Tax Calculation**: Q4 tax adjustment was hardcoded, finance wants it configurable"

### From Sarah (DevOps):
"Additional context:
- The EC2 instance runs Ubuntu 16.04 (EOL)
- Python 2.7 (also EOL) 
- ReportLab version 2.5 (from 2010!)
- No monitoring, we only know it failed when finance complains
- Cron runs it every 2 hours: `0 */2 * * * /usr/bin/python2.7 /opt/invoice_processor/process_invoices.py`
- Takes 45 mins for 1000 invoices on a good day"

## Business Rules Summary (from Finance Team via Alex)

### Tax Rules:
1. Base tax by state (see STATE_TAX_RATES in script)
2. Some customers have negotiated rates (CUSTOMER_TAX_OVERRIDES)
3. Q4 gets 2% additional tax (Oct-Dec) - year-end accounting rule
4. Tax exempt customers (nonprofits) should have 0% tax
5. Bulk orders (>$10k) get 3% discount BEFORE tax calculation

### Late Fees:
1. Applied after 30 days past due
2. 1.5% per month (not compounded despite code comment)
3. Should cap at 18% total (not implemented)

### Invoice Rules:
1. Minimum invoice amount: $25
2. Invoice filename format: CUSTOMERID_DATE_TOTAL.pdf
3. All amounts rounded to 2 decimal places

### Edge Cases We've Seen:
- Negative amounts (credits) - script crashes
- $0 invoices - should skip but doesn't
- Same customer, same day, multiple invoices - overwrites PDF
- Items field sometimes has commas in item names - breaks parsing
- Some customers put quantity as decimal (1.5 hours) - works accidentally