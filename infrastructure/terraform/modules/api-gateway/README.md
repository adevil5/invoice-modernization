# API Gateway Module

This module creates an AWS API Gateway REST API for the Invoice Modernization project.

## Features

- REST API with regional endpoint configuration
- Request validation using JSON Schema models
- API key authentication with usage plans and throttling
- CORS support with configurable origins
- CloudWatch logging and X-Ray tracing
- Optional caching configuration
- Automatic deployment triggers

## Usage

```hcl
module "api_gateway" {
  source = "./modules/api-gateway"
  
  project_name = "invoice-modernization"
  environment  = "dev"
  stage_name   = "v1"
  
  # Lambda function integration
  create_invoice_lambda_invoke_arn    = module.create_invoice_lambda.invoke_arn
  create_invoice_lambda_function_name = module.create_invoice_lambda.function_name
  
  get_invoice_lambda_invoke_arn    = module.get_invoice_lambda.invoke_arn
  get_invoice_lambda_function_name = module.get_invoice_lambda.function_name
  
  list_invoices_lambda_invoke_arn    = module.list_invoices_lambda.invoke_arn
  list_invoices_lambda_function_name = module.list_invoices_lambda.function_name
  
  # Logging
  cloudwatch_log_group_arn = aws_cloudwatch_log_group.api_gateway.arn
  log_retention_days       = 7
  api_logging_level        = "ERROR"
  
  # Throttling
  api_throttle_rate_limit  = 50
  api_throttle_burst_limit = 100
  
  # CORS
  allowed_cors_origins = ["https://example.com", "http://localhost:3000"]
  
  # Caching (optional)
  enable_api_caching = false
  api_cache_size     = "0.5"
  
  # X-Ray tracing
  enable_xray_tracing = true
  
  common_tags = {
    Project     = "invoice-modernization"
    Environment = "dev"
  }
}
```

## Endpoints

The module creates the following endpoints:

- `POST /invoices` - Create a new invoice
- `GET /invoices` - List invoices with optional filtering
- `GET /invoices/{id}` - Get a specific invoice by ID

## Authentication

All endpoints require an API key passed in the `x-api-key` header.

## Request Validation

### POST /invoices

Request body must match the CreateInvoiceRequest schema:

```json
{
  "invoiceNumber": "INV-001",
  "customerId": "CUST-123",
  "customerName": "Acme Corp",
  "customerAddress": {
    "street": "123 Main St",
    "city": "Springfield",
    "state": "IL",
    "zip": "62701"
  },
  "invoiceDate": "2024-01-15",
  "dueDate": "2024-02-15",
  "items": [
    {
      "description": "Widget",
      "quantity": 10,
      "unitPrice": 9.99
    }
  ],
  "customerTaxOverride": 0.08
}
```

### GET /invoices

Query parameters (all optional):
- `limit` - Number of results to return
- `nextToken` - Pagination token
- `status` - Filter by invoice status
- `customerId` - Filter by customer ID
- `startDate` - Filter by date range (start)
- `endDate` - Filter by date range (end)

### GET /invoices/{id}

Path parameters:
- `id` - Invoice ID (required)

## Throttling

The module implements throttling at two levels:

1. **Usage Plan Level**: Applied to API keys
   - Default: 50 requests/second, 100 burst
   - Quota: 10,000 requests/day

2. **Method Level**: Applied to all methods
   - Configurable via `method_throttle_*` variables

## Monitoring

- CloudWatch Logs: Access logs with detailed request/response information
- X-Ray Tracing: Distributed tracing for performance analysis
- CloudWatch Metrics: API Gateway metrics for monitoring

## Outputs

- `api_id` - The ID of the API Gateway REST API
- `api_endpoint` - The base URL of the API
- `api_key_value` - The API key value (sensitive)
- `endpoints` - Map of all endpoint URLs

## Notes

- The `create_cloudwatch_role` variable should only be set to `true` once per AWS account/region
- CORS is automatically configured for all resources
- The module uses Lambda proxy integration for simplified request/response handling