# S3 Bucket Outputs
output "lambda_deployments_bucket" {
  description = "S3 bucket for Lambda deployment packages"
  value = {
    id          = aws_s3_bucket.lambda_deployments.id
    arn         = aws_s3_bucket.lambda_deployments.arn
    domain_name = aws_s3_bucket.lambda_deployments.bucket_domain_name
  }
}

output "invoices_bucket" {
  description = "S3 bucket for processed invoices"
  value = {
    id          = aws_s3_bucket.invoices.id
    arn         = aws_s3_bucket.invoices.arn
    domain_name = aws_s3_bucket.invoices.bucket_domain_name
  }
}

# DynamoDB Outputs
output "dynamodb_table" {
  description = "DynamoDB table for invoices"
  value = {
    name         = module.invoice_dynamodb.table_name
    arn          = module.invoice_dynamodb.table_arn
    stream_arn   = module.invoice_dynamodb.table_stream_arn
    billing_mode = module.invoice_dynamodb.table_billing_mode
    gsi_names    = module.invoice_dynamodb.gsi_names
  }
}

# CloudWatch Outputs
output "cloudwatch_log_group" {
  description = "CloudWatch log group for Lambda functions"
  value = {
    name = aws_cloudwatch_log_group.lambda_logs.name
    arn  = aws_cloudwatch_log_group.lambda_logs.arn
  }
}

# EventBridge Outputs
output "event_bus" {
  description = "EventBridge event bus"
  value = {
    name = aws_cloudwatch_event_bus.main.name
    arn  = aws_cloudwatch_event_bus.main.arn
  }
}

# KMS Outputs
output "kms_key" {
  description = "KMS key for encryption"
  value = {
    id    = aws_kms_key.main.id
    arn   = aws_kms_key.main.arn
    alias = aws_kms_alias.main.name
  }
  sensitive = true
}

# Account and Region Information
output "aws_account_id" {
  description = "AWS Account ID"
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  description = "AWS Region"
  value       = var.aws_region
}

output "environment" {
  description = "Current environment (Terraform workspace)"
  value       = local.environment
}

# Environment Configuration
output "environment_config" {
  description = "Current environment configuration"
  value       = local.current_env_config
}

# Tags
output "common_tags" {
  description = "Common tags applied to all resources"
  value       = local.common_tags
}