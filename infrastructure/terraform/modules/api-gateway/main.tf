terraform {
  required_version = ">= 1.12.0"
}

# Data source for current AWS region
data "aws_region" "current" {}

locals {
  api_name = "${var.project_name}-api-${var.environment}"
  
  # Standard error response for all endpoints
  error_response_template = jsonencode({
    message = "$context.error.message"
    type    = "$context.error.messageString"
    statusCode = "$context.error.responseType"
    requestId  = "$context.requestId"
  })
}

# REST API
resource "aws_api_gateway_rest_api" "main" {
  name        = local.api_name
  description = "Invoice Modernization API - ${var.environment}"
  
  endpoint_configuration {
    types = ["REGIONAL"]
  }
  
  # Support binary media types for future file uploads
  binary_media_types = [
    "application/pdf",
    "text/csv",
    "application/octet-stream"
  ]
  
  tags = merge(var.common_tags, {
    Name = local.api_name
  })
}

# API Models
resource "aws_api_gateway_model" "create_invoice_request" {
  rest_api_id  = aws_api_gateway_rest_api.main.id
  name         = "CreateInvoiceRequest"
  content_type = "application/json"
  
  schema = jsonencode({
    "$schema" = "http://json-schema.org/draft-04/schema#"
    title     = "CreateInvoiceRequest"
    type      = "object"
    required  = ["invoiceNumber", "customerId", "customerName", "customerAddress", "invoiceDate", "dueDate", "items"]
    properties = {
      invoiceNumber = {
        type = "string"
        pattern = "^[A-Z0-9-]+$"
      }
      customerId = {
        type = "string"
      }
      customerName = {
        type = "string"
        minLength = 1
      }
      customerAddress = {
        type = "object"
        required = ["street", "city", "state", "zip"]
        properties = {
          street = { type = "string", minLength = 1 }
          city   = { type = "string", minLength = 1 }
          state  = { type = "string", pattern = "^[A-Z]{2}$" }
          zip    = { type = "string", pattern = "^\\d{5}(-\\d{4})?$" }
        }
      }
      invoiceDate = {
        type = "string"
        format = "date"
      }
      dueDate = {
        type = "string"
        format = "date"
      }
      items = {
        type = "array"
        minItems = 1
        items = {
          type = "object"
          required = ["description", "quantity", "unitPrice"]
          properties = {
            description = { type = "string", minLength = 1 }
            quantity    = { type = "number", minimum = 1 }
            unitPrice   = { type = "number", minimum = 0 }
          }
        }
      }
      customerTaxOverride = {
        type = "number"
        minimum = 0
        maximum = 1
      }
    }
  })
}

resource "aws_api_gateway_model" "error_response" {
  rest_api_id  = aws_api_gateway_rest_api.main.id
  name         = "ErrorResponse"
  content_type = "application/json"
  
  schema = jsonencode({
    "$schema" = "http://json-schema.org/draft-04/schema#"
    title     = "ErrorResponse"
    type      = "object"
    properties = {
      message    = { type = "string" }
      type       = { type = "string" }
      statusCode = { type = "integer" }
      requestId  = { type = "string" }
    }
  })
}

# Request Validators
resource "aws_api_gateway_request_validator" "validate_body" {
  name                        = "validate-request-body"
  rest_api_id                 = aws_api_gateway_rest_api.main.id
  validate_request_body       = true
  validate_request_parameters = false
}

resource "aws_api_gateway_request_validator" "validate_params" {
  name                        = "validate-request-parameters"
  rest_api_id                 = aws_api_gateway_rest_api.main.id
  validate_request_body       = false
  validate_request_parameters = true
}

resource "aws_api_gateway_request_validator" "validate_all" {
  name                        = "validate-all"
  rest_api_id                 = aws_api_gateway_rest_api.main.id
  validate_request_body       = true
  validate_request_parameters = true
}

# /invoices resource
resource "aws_api_gateway_resource" "invoices" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_rest_api.main.root_resource_id
  path_part   = "invoices"
}

# /invoices/{id} resource
resource "aws_api_gateway_resource" "invoice_by_id" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  parent_id   = aws_api_gateway_resource.invoices.id
  path_part   = "{id}"
}

# POST /invoices
resource "aws_api_gateway_method" "create_invoice" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.invoices.id
  http_method   = "POST"
  authorization = "API_KEY"
  
  request_models = {
    "application/json" = aws_api_gateway_model.create_invoice_request.name
  }
  
  request_validator_id = aws_api_gateway_request_validator.validate_body.id
}

resource "aws_api_gateway_integration" "create_invoice" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.invoices.id
  http_method = aws_api_gateway_method.create_invoice.http_method
  
  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.create_invoice_lambda_invoke_arn
}

# GET /invoices
resource "aws_api_gateway_method" "list_invoices" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.invoices.id
  http_method   = "GET"
  authorization = "API_KEY"
  
  request_parameters = {
    "method.request.querystring.limit"      = false
    "method.request.querystring.nextToken"  = false
    "method.request.querystring.status"     = false
    "method.request.querystring.customerId" = false
    "method.request.querystring.startDate"  = false
    "method.request.querystring.endDate"    = false
  }
  
  request_validator_id = aws_api_gateway_request_validator.validate_params.id
}

resource "aws_api_gateway_integration" "list_invoices" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.invoices.id
  http_method = aws_api_gateway_method.list_invoices.http_method
  
  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.list_invoices_lambda_invoke_arn
}

# GET /invoices/{id}
resource "aws_api_gateway_method" "get_invoice" {
  rest_api_id   = aws_api_gateway_rest_api.main.id
  resource_id   = aws_api_gateway_resource.invoice_by_id.id
  http_method   = "GET"
  authorization = "API_KEY"
  
  request_parameters = {
    "method.request.path.id" = true
  }
  
  request_validator_id = aws_api_gateway_request_validator.validate_params.id
}

resource "aws_api_gateway_integration" "get_invoice" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  resource_id = aws_api_gateway_resource.invoice_by_id.id
  http_method = aws_api_gateway_method.get_invoice.http_method
  
  integration_http_method = "POST"
  type                   = "AWS_PROXY"
  uri                    = var.get_invoice_lambda_invoke_arn
}

# CORS Configuration
module "cors_invoices" {
  source = "../api-gateway-cors"
  
  api_id          = aws_api_gateway_rest_api.main.id
  api_resource_id = aws_api_gateway_resource.invoices.id
  allowed_origins = var.allowed_cors_origins
}

module "cors_invoice_by_id" {
  source = "../api-gateway-cors"
  
  api_id          = aws_api_gateway_rest_api.main.id
  api_resource_id = aws_api_gateway_resource.invoice_by_id.id
  allowed_origins = var.allowed_cors_origins
}

# API Key
resource "aws_api_gateway_api_key" "main" {
  name        = "${local.api_name}-key"
  description = "API key for ${local.api_name}"
  enabled     = true
  
  tags = merge(var.common_tags, {
    Name = "${local.api_name}-key"
  })
}

# Usage Plan
resource "aws_api_gateway_usage_plan" "main" {
  name        = "${local.api_name}-usage-plan"
  description = "Usage plan for ${local.api_name}"
  
  api_stages {
    api_id = aws_api_gateway_rest_api.main.id
    stage  = aws_api_gateway_stage.main.stage_name
  }
  
  quota_settings {
    limit  = var.api_quota_limit
    period = var.api_quota_period
  }
  
  throttle_settings {
    rate_limit  = var.api_throttle_rate_limit
    burst_limit = var.api_throttle_burst_limit
  }
  
  tags = merge(var.common_tags, {
    Name = "${local.api_name}-usage-plan"
  })
  
  depends_on = [aws_api_gateway_stage.main]
}

# Usage Plan Key
resource "aws_api_gateway_usage_plan_key" "main" {
  key_id        = aws_api_gateway_api_key.main.id
  key_type      = "API_KEY"
  usage_plan_id = aws_api_gateway_usage_plan.main.id
}

# Deployment
resource "aws_api_gateway_deployment" "main" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  
  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.invoices.id,
      aws_api_gateway_resource.invoice_by_id.id,
      aws_api_gateway_method.create_invoice.id,
      aws_api_gateway_method.list_invoices.id,
      aws_api_gateway_method.get_invoice.id,
      aws_api_gateway_integration.create_invoice.id,
      aws_api_gateway_integration.list_invoices.id,
      aws_api_gateway_integration.get_invoice.id,
    ]))
  }
  
  lifecycle {
    create_before_destroy = true
  }
}

# Stage Configuration
resource "aws_api_gateway_stage" "main" {
  deployment_id = aws_api_gateway_deployment.main.id
  rest_api_id   = aws_api_gateway_rest_api.main.id
  stage_name    = var.stage_name
  
  xray_tracing_enabled = var.enable_xray_tracing
  
  # Caching
  cache_cluster_enabled = var.enable_api_caching
  cache_cluster_size    = var.enable_api_caching ? var.api_cache_size : null
  
  # Logging
  access_log_settings {
    destination_arn = var.cloudwatch_log_group_arn
    format = jsonencode({
      requestId      = "$context.requestId"
      requestTime    = "$context.requestTime"
      requestTimeEpoch = "$context.requestTimeEpoch"
      path           = "$context.path"
      method         = "$context.httpMethod"
      status         = "$context.status"
      protocol       = "$context.protocol"
      responseLength = "$context.responseLength"
      error          = "$context.error.message"
      integrationError = "$context.integrationErrorMessage"
      integrationStatus = "$context.integration.status"
      integrationLatency = "$context.integration.latency"
      responseLatency = "$context.responseLatency"
      sourceIp       = "$context.identity.sourceIp"
      userAgent      = "$context.identity.userAgent"
      apiKey         = "$context.identity.apiKeyId"
    })
  }
  
  tags = merge(var.common_tags, {
    Name = "${local.api_name}-${var.stage_name}"
  })
}

# Method Settings for all methods
resource "aws_api_gateway_method_settings" "all" {
  rest_api_id = aws_api_gateway_rest_api.main.id
  stage_name  = aws_api_gateway_stage.main.stage_name
  method_path = "*/*"
  
  settings {
    metrics_enabled        = true
    logging_level         = var.api_logging_level
    data_trace_enabled    = var.api_logging_level == "INFO" ? true : false
    throttling_rate_limit = var.method_throttle_rate_limit
    throttling_burst_limit = var.method_throttle_burst_limit
  }
}

# CloudWatch Log Group for API Gateway
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${local.api_name}"
  retention_in_days = var.log_retention_days
  
  tags = merge(var.common_tags, {
    Name = "${local.api_name}-logs"
  })
}

# IAM role for API Gateway CloudWatch logging
resource "aws_iam_role" "api_gateway_cloudwatch" {
  count = var.create_cloudwatch_role ? 1 : 0
  
  name = "${local.api_name}-cloudwatch-role"
  
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "apigateway.amazonaws.com"
        }
      }
    ]
  })
  
  tags = var.common_tags
}

resource "aws_iam_role_policy_attachment" "api_gateway_cloudwatch" {
  count = var.create_cloudwatch_role ? 1 : 0
  
  role       = aws_iam_role.api_gateway_cloudwatch[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonAPIGatewayPushToCloudWatchLogs"
}

# API Gateway account settings (only needed once per account/region)
resource "aws_api_gateway_account" "main" {
  count = var.create_cloudwatch_role ? 1 : 0
  
  cloudwatch_role_arn = aws_iam_role.api_gateway_cloudwatch[0].arn
  
  depends_on = [aws_iam_role_policy_attachment.api_gateway_cloudwatch]
}