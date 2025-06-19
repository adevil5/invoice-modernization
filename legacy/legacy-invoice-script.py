#!/usr/bin/env python2.7
# -*- coding: utf-8 -*-
"""
Invoice Processing Script v1.3
Created: 2019-03-15
Last Modified: 2021-07-22 by jsmith (added quarterly tax fix)
Author: Unknown (original dev left in 2021)

WARNING: DO NOT MODIFY WITHOUT TESTING - FINANCE DEPENDS ON THIS
"""

import csv
import os
import sys
import smtplib
import datetime
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

# HARDCODED PATHS - DO NOT CHANGE
CSV_INPUT_PATH = "/mnt/finance_share/invoices/pending/"
PDF_OUTPUT_PATH = "/mnt/finance_share/invoices/processed/"
ERROR_LOG = "/var/log/invoice_errors.log"

# TAX RULES - Updated quarterly by finance team
# TODO: Move these to config file (ticket #4521 - 2020)
STATE_TAX_RATES = {
    "CA": 0.0725,
    "NY": 0.08,
    "TX": 0.0625,
    "FL": 0.06,
    "WA": 0.065,
    "DEFAULT": 0.05  # Used when state not found
}

# Special customer tax overrides (negotiated rates)
CUSTOMER_TAX_OVERRIDES = {
    "CUST001": 0.0,     # Tax exempt - nonprofit  
    "CUST447": 0.045,   # Negotiated rate
    "CUST892": 0.0725,  # Always CA rate regardless of location
}

# Magic numbers - DO NOT CHANGE
LATE_FEE_DAYS = 30
LATE_FEE_PERCENT = 0.015  # 1.5% monthly
MIN_INVOICE_AMOUNT = 25.00
BULK_DISCOUNT_THRESHOLD = 10000.00
BULK_DISCOUNT_RATE = 0.03  # 3% discount

# Email settings - hardcoded SMTP
SMTP_SERVER = "10.0.1.25"
SMTP_PORT = 25
FROM_EMAIL = "invoices@company.local"

def process_csv_file(filename):
    """
    Process a single CSV file. Expected format:
    customer_id,customer_name,address,city,state,zip,amount,invoice_date,due_date,items
    
    Note: 'items' field is pipe-delimited list of item:quantity:price
    Example: "Widget A:2:49.99|Widget B:1:99.99"
    """
    invoices = []
    
    try:
        with open(filename, 'rb') as csvfile:
            # Try different delimiters - some customers use semicolons
            delimiter = ','
            first_line = csvfile.readline()
            if ';' in first_line:
                delimiter = ';'
            csvfile.seek(0)
            
            reader = csv.reader(csvfile, delimiter=delimiter)
            headers = reader.next()  # Skip header
            
            for row_num, row in enumerate(reader):
                if len(row) < 10:
                    print "WARNING: Row %d has insufficient columns, skipping" % row_num
                    continue
                    
                try:
                    invoice = {
                        'customer_id': row[0].strip(),
                        'customer_name': row[1].strip(),
                        'address': row[2].strip(),
                        'city': row[3].strip(),
                        'state': row[4].strip().upper(),
                        'zip': row[5].strip(),
                        'amount': float(row[6]),
                        'invoice_date': row[7].strip(),
                        'due_date': row[8].strip(),
                        'items': row[9].strip() if len(row) > 9 else ""
                    }
                    
                    # Validate amount
                    if invoice['amount'] < MIN_INVOICE_AMOUNT:
                        print "WARNING: Invoice amount $%.2f below minimum for %s" % (
                            invoice['amount'], invoice['customer_id'])
                        continue
                    
                    invoices.append(invoice)
                    
                except ValueError as e:
                    print "ERROR parsing row %d: %s" % (row_num, str(e))
                    log_error("Parse error in %s row %d: %s" % (filename, row_num, str(e)))
                    
    except Exception as e:
        print "FATAL: Cannot read file %s: %s" % (filename, str(e))
        log_error("Cannot read file %s: %s" % (filename, str(e)))
        sys.exit(1)
        
    return invoices

def calculate_tax(invoice):
    """
    Calculate tax based on complex business rules
    Returns: tax amount
    """
    base_amount = invoice['amount']
    state = invoice['state']
    customer_id = invoice['customer_id']
    
    # Check for customer override first
    if customer_id in CUSTOMER_TAX_OVERRIDES:
        tax_rate = CUSTOMER_TAX_OVERRIDES[customer_id]
    elif state in STATE_TAX_RATES:
        tax_rate = STATE_TAX_RATES[state]
    else:
        tax_rate = STATE_TAX_RATES['DEFAULT']
        print "WARNING: Unknown state '%s', using default tax rate" % state
    
    # Special quarterly tax adjustment for Q4 (Oct-Dec)
    # Added by jsmith - finance requested this for year-end
    current_month = datetime.datetime.now().month
    if current_month >= 10:
        tax_rate = tax_rate * 1.02  # 2% increase for Q4
    
    # Bulk discount affects taxable amount
    if base_amount >= BULK_DISCOUNT_THRESHOLD:
        base_amount = base_amount * (1 - BULK_DISCOUNT_RATE)
    
    return round(base_amount * tax_rate, 2)

def calculate_late_fee(invoice):
    """
    Calculate late fee if applicable
    """
    try:
        # Parse dates - multiple formats seen in production
        # Common formats: MM/DD/YYYY, YYYY-MM-DD, MM-DD-YYYY
        due_date_str = invoice['due_date']
        
        # Try different date formats
        for fmt in ['%m/%d/%Y', '%Y-%m-%d', '%m-%d-%Y']:
            try:
                due_date = datetime.datetime.strptime(due_date_str, fmt)
                break
            except ValueError:
                continue
        else:
            print "ERROR: Cannot parse date '%s'" % due_date_str
            return 0.0
            
        days_late = (datetime.datetime.now() - due_date).days
        
        if days_late > LATE_FEE_DAYS:
            # Compound monthly
            months_late = days_late / 30
            late_fee = invoice['amount'] * (LATE_FEE_PERCENT * months_late)
            return round(late_fee, 2)
            
    except Exception as e:
        log_error("Late fee calculation error: %s" % str(e))
        
    return 0.0

def generate_pdf(invoice, tax_amount, late_fee):
    """
    Generate PDF invoice using ReportLab
    """
    total = invoice['amount'] + tax_amount + late_fee
    
    # Create filename: CUSTOMERID_INVOICEDATE_AMOUNT.pdf
    invoice_date_clean = invoice['invoice_date'].replace('/', '-')
    filename = "%s%s_%s_%.2f.pdf" % (
        PDF_OUTPUT_PATH,
        invoice['customer_id'],
        invoice_date_clean,
        total
    )
    
    try:
        c = canvas.Canvas(filename, pagesize=letter)
        width, height = letter
        
        # Company header - hardcoded position
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, height - 50, "ACME Corp Invoice")
        
        c.setFont("Helvetica", 10)
        c.drawString(50, height - 70, "123 Business St, Suite 100")
        c.drawString(50, height - 85, "San Francisco, CA 94105")
        
        # Invoice details
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, height - 120, "INVOICE")
        
        c.setFont("Helvetica", 10)
        y_pos = height - 150
        
        # Customer info
        c.drawString(50, y_pos, "Bill To:")
        y_pos -= 15
        c.drawString(70, y_pos, invoice['customer_name'])
        y_pos -= 15
        c.drawString(70, y_pos, invoice['address'])
        y_pos -= 15
        c.drawString(70, y_pos, "%s, %s %s" % (
            invoice['city'], invoice['state'], invoice['zip']))
        
        # Invoice details
        y_pos -= 40
        c.drawString(50, y_pos, "Invoice Date: %s" % invoice['invoice_date'])
        y_pos -= 15
        c.drawString(50, y_pos, "Due Date: %s" % invoice['due_date'])
        y_pos -= 15
        c.drawString(50, y_pos, "Customer ID: %s" % invoice['customer_id'])
        
        # Items (if provided)
        if invoice['items']:
            y_pos -= 30
            c.setFont("Helvetica-Bold", 10)
            c.drawString(50, y_pos, "Items:")
            c.setFont("Helvetica", 10)
            
            items = invoice['items'].split('|')
            for item in items:
                y_pos -= 15
                try:
                    parts = item.split(':')
                    if len(parts) == 3:
                        c.drawString(70, y_pos, "%s x %s @ $%s" % (
                            parts[1], parts[0], parts[2]))
                except:
                    c.drawString(70, y_pos, item)  # Fallback
        
        # Totals
        y_pos -= 40
        c.line(300, y_pos, 500, y_pos)
        y_pos -= 20
        c.drawString(300, y_pos, "Subtotal:")
        c.drawString(450, y_pos, "$%.2f" % invoice['amount'])
        
        if tax_amount > 0:
            y_pos -= 15
            c.drawString(300, y_pos, "Tax:")
            c.drawString(450, y_pos, "$%.2f" % tax_amount)
            
        if late_fee > 0:
            y_pos -= 15
            c.drawString(300, y_pos, "Late Fee:")
            c.drawString(450, y_pos, "$%.2f" % late_fee)
            
        y_pos -= 20
        c.line(300, y_pos, 500, y_pos)
        y_pos -= 20
        c.setFont("Helvetica-Bold", 12)
        c.drawString(300, y_pos, "Total Due:")
        c.drawString(450, y_pos, "$%.2f" % total)
        
        c.save()
        return filename
        
    except Exception as e:
        log_error("PDF generation failed: %s" % str(e))
        return None

def send_email(invoice, pdf_filename):
    """
    Send invoice email with PDF attachment
    WARNING: No authentication on SMTP server
    """
    # Email logic removed for brevity but includes:
    # - Hardcoded SMTP connection
    # - No retry logic
    # - Assumes customer email is customer_id@domain.com
    pass

def log_error(message):
    """Simple error logging"""
    try:
        with open(ERROR_LOG, 'a') as f:
            timestamp = datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            f.write("[%s] %s\n" % (timestamp, message))
    except:
        pass  # Silently fail if can't write log

def main():
    """
    Main processing loop
    Processes all CSV files in input directory
    """
    print "Starting invoice processing..."
    print "Input path: %s" % CSV_INPUT_PATH
    print "Output path: %s" % PDF_OUTPUT_PATH
    
    # Check if paths exist
    if not os.path.exists(CSV_INPUT_PATH):
        print "FATAL: Input path does not exist!"
        sys.exit(1)
        
    if not os.path.exists(PDF_OUTPUT_PATH):
        print "FATAL: Output path does not exist!"
        sys.exit(1)
    
    # Process all CSV files
    csv_files = [f for f in os.listdir(CSV_INPUT_PATH) if f.endswith('.csv')]
    
    if not csv_files:
        print "No CSV files found to process"
        return
        
    total_processed = 0
    total_failed = 0
    
    for csv_file in csv_files:
        print "\nProcessing: %s" % csv_file
        full_path = os.path.join(CSV_INPUT_PATH, csv_file)
        
        invoices = process_csv_file(full_path)
        print "Found %d valid invoices" % len(invoices)
        
        for invoice in invoices:
            try:
                # Calculate amounts
                tax = calculate_tax(invoice)
                late_fee = calculate_late_fee(invoice)
                
                # Generate PDF
                pdf_file = generate_pdf(invoice, tax, late_fee)
                
                if pdf_file:
                    print "Generated: %s" % os.path.basename(pdf_file)
                    
                    # Send email (commented out in production due to issues)
                    # send_email(invoice, pdf_file)
                    
                    total_processed += 1
                else:
                    total_failed += 1
                    
            except Exception as e:
                print "ERROR processing invoice: %s" % str(e)
                log_error("Processing failed for customer %s: %s" % (
                    invoice.get('customer_id', 'UNKNOWN'), str(e)))
                total_failed += 1
        
        # Move processed file
        try:
            processed_name = csv_file.replace('.csv', '_processed_%s.csv' % 
                datetime.datetime.now().strftime('%Y%m%d%H%M%S'))
            os.rename(full_path, os.path.join(CSV_INPUT_PATH, 'processed', processed_name))
        except:
            print "WARNING: Could not move processed file"
    
    print "\n" + "="*50
    print "PROCESSING COMPLETE"
    print "Total processed: %d" % total_processed
    print "Total failed: %d" % total_failed
    print "="*50

if __name__ == "__main__":
    main()
