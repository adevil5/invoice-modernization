output "table_name" {
  description = "Name of the DynamoDB table"
  value       = aws_dynamodb_table.invoice_table.name
}

output "table_arn" {
  description = "ARN of the DynamoDB table"
  value       = aws_dynamodb_table.invoice_table.arn
}

output "table_id" {
  description = "ID of the DynamoDB table"
  value       = aws_dynamodb_table.invoice_table.id
}

output "table_stream_arn" {
  description = "ARN of the DynamoDB table stream"
  value       = aws_dynamodb_table.invoice_table.stream_arn
}

output "gsi_names" {
  description = "List of Global Secondary Index names"
  value = [
    "customerId-createdAt-index",
    "status-createdAt-index",
    "createdAt-index"
  ]
}

output "table_billing_mode" {
  description = "Billing mode of the DynamoDB table"
  value       = aws_dynamodb_table.invoice_table.billing_mode
}