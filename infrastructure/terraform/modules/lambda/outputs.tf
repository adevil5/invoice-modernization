output "function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.this.function_name
}

output "function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.this.arn
}

output "function_invoke_arn" {
  description = "Invoke ARN of the Lambda function"
  value       = aws_lambda_function.this.invoke_arn
}

output "function_qualified_arn" {
  description = "Qualified ARN of the Lambda function (with version)"
  value       = aws_lambda_function.this.qualified_arn
}

output "function_version" {
  description = "Latest published version of the Lambda function"
  value       = aws_lambda_function.this.version
}

output "function_alias_arn" {
  description = "ARN of the live alias"
  value       = aws_lambda_alias.live.arn
}

output "function_alias_invoke_arn" {
  description = "Invoke ARN of the live alias"
  value       = aws_lambda_alias.live.invoke_arn
}

output "role_arn" {
  description = "ARN of the Lambda execution role"
  value       = aws_iam_role.lambda_execution.arn
}

output "role_name" {
  description = "Name of the Lambda execution role"
  value       = aws_iam_role.lambda_execution.name
}

output "log_group_name" {
  description = "Name of the CloudWatch log group"
  value       = var.log_group_name
}