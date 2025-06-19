output "api_id" {
  description = "The ID of the API Gateway REST API"
  value       = aws_api_gateway_rest_api.main.id
}

output "api_arn" {
  description = "The ARN of the API Gateway REST API"
  value       = aws_api_gateway_rest_api.main.arn
}

output "api_name" {
  description = "The name of the API Gateway REST API"
  value       = aws_api_gateway_rest_api.main.name
}

output "api_endpoint" {
  description = "The endpoint URL of the API Gateway REST API"
  value       = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_stage.main.stage_name}"
}

output "api_stage_arn" {
  description = "The ARN of the API Gateway stage"
  value       = aws_api_gateway_stage.main.arn
}

output "api_stage_name" {
  description = "The name of the API Gateway stage"
  value       = aws_api_gateway_stage.main.stage_name
}

output "api_key_id" {
  description = "The ID of the API key"
  value       = aws_api_gateway_api_key.main.id
}

output "api_key_value" {
  description = "The value of the API key"
  value       = aws_api_gateway_api_key.main.value
  sensitive   = true
}

output "usage_plan_id" {
  description = "The ID of the API Gateway usage plan"
  value       = aws_api_gateway_usage_plan.main.id
}

output "cloudwatch_log_group_name" {
  description = "The name of the CloudWatch log group for API Gateway"
  value       = aws_cloudwatch_log_group.api_gateway.name
}

output "cloudwatch_log_group_arn" {
  description = "The ARN of the CloudWatch log group for API Gateway"
  value       = aws_cloudwatch_log_group.api_gateway.arn
}

# Resource IDs for external integrations
output "invoices_resource_id" {
  description = "The resource ID for /invoices"
  value       = aws_api_gateway_resource.invoices.id
}

output "invoice_by_id_resource_id" {
  description = "The resource ID for /invoices/{id}"
  value       = aws_api_gateway_resource.invoice_by_id.id
}

# Endpoint URLs
output "endpoints" {
  description = "API endpoint URLs"
  value = {
    base_url      = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_stage.main.stage_name}"
    create_invoice = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_stage.main.stage_name}/invoices"
    get_invoice    = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_stage.main.stage_name}/invoices/{id}"
    list_invoices  = "https://${aws_api_gateway_rest_api.main.id}.execute-api.${data.aws_region.current.name}.amazonaws.com/${aws_api_gateway_stage.main.stage_name}/invoices"
  }
}