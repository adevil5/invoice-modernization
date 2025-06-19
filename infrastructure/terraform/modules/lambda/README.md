# Lambda Module

This module creates an AWS Lambda function with all necessary configurations including IAM roles, permissions, and optional features like VPC configuration, dead letter queues, and auto-scaling.

## Features

- IAM role with least-privilege permissions
- Support for custom IAM policy statements
- VPC configuration (optional)
- Dead letter queue configuration (optional)
- X-Ray tracing support
- Blue-green deployment with aliases
- Auto-scaling for provisioned concurrency
- CloudWatch logs integration
- Multiple trigger permissions support
- ARM64 architecture by default for better price/performance

## Usage

```hcl
module "create_invoice_lambda" {
  source = "./modules/lambda"

  project_name  = "invoice-modernization"
  function_name = "create-invoice"
  environment   = "dev"
  
  handler       = "create-invoice-handler.handler"
  runtime       = "nodejs22.x"
  timeout       = 30
  memory_size   = 512
  architecture  = "arm64"
  
  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = "create-invoice-handler.zip"
  
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  
  environment_variables = {
    DYNAMODB_TABLE_NAME = module.invoice_dynamodb.table_name
    EVENTBRIDGE_BUS_NAME = aws_cloudwatch_event_bus.main.name
  }
  
  policy_statements = [
    {
      Effect = "Allow"
      Action = [
        "dynamodb:PutItem",
        "dynamodb:GetItem",
        "dynamodb:UpdateItem"
      ]
      Resource = [module.invoice_dynamodb.table_arn]
    },
    {
      Effect = "Allow"
      Action = ["events:PutEvents"]
      Resource = [aws_cloudwatch_event_bus.main.arn]
    }
  ]
  
  trigger_permissions = {
    api_gateway = {
      principal  = "apigateway.amazonaws.com"
      source_arn = "${aws_api_gateway_rest_api.main.execution_arn}/*/*"
    }
  }
  
  common_tags = local.common_tags
}
```

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|----------|
| project_name | Name of the project | string | - | yes |
| function_name | Name of the Lambda function (without environment suffix) | string | - | yes |
| environment | Environment name (dev, staging, prod) | string | - | yes |
| handler | Lambda function handler | string | - | yes |
| runtime | Lambda runtime | string | "nodejs22.x" | no |
| timeout | Lambda function timeout in seconds | number | 30 | no |
| memory_size | Lambda function memory size in MB | number | 512 | no |
| architecture | Lambda function architecture (x86_64 or arm64) | string | "arm64" | no |
| s3_bucket | S3 bucket containing the Lambda deployment package | string | - | yes |
| s3_key | S3 key of the Lambda deployment package | string | - | yes |
| environment_variables | Environment variables for the Lambda function | map(string) | {} | no |
| policy_statements | IAM policy statements for the Lambda function | list(object) | [] | no |
| vpc_config | VPC configuration for the Lambda function | object | null | no |
| dead_letter_config | Dead letter queue configuration | object | null | no |
| enable_xray_tracing | Enable AWS X-Ray tracing | bool | true | no |
| reserved_concurrent_executions | Reserved concurrent executions | number | -1 | no |
| log_group_name | CloudWatch log group name | string | - | yes |
| log_subscription_destination | ARN of the destination for log subscription | string | null | no |
| log_filter_pattern | Filter pattern for log subscription | string | "" | no |
| trigger_permissions | Map of trigger permissions for the Lambda function | map(object) | {} | no |
| publish | Whether to publish a new version of the Lambda function | bool | false | no |
| enable_provisioned_concurrency | Enable provisioned concurrency and auto-scaling | bool | false | no |
| provisioned_concurrent_executions_min | Minimum provisioned concurrent executions | number | 1 | no |
| provisioned_concurrent_executions_max | Maximum provisioned concurrent executions | number | 10 | no |
| common_tags | Common tags to apply to all resources | map(string) | {} | no |

## Outputs

| Name | Description |
|------|-------------|
| function_name | Name of the Lambda function |
| function_arn | ARN of the Lambda function |
| function_invoke_arn | Invoke ARN of the Lambda function |
| function_qualified_arn | Qualified ARN of the Lambda function (with version) |
| function_version | Latest published version of the Lambda function |
| function_alias_arn | ARN of the live alias |
| function_alias_invoke_arn | Invoke ARN of the live alias |
| role_arn | ARN of the Lambda execution role |
| role_name | Name of the Lambda execution role |
| log_group_name | Name of the CloudWatch log group |

## Best Practices

1. **IAM Permissions**: Always follow the principle of least privilege. Only grant the minimum permissions required for the function to operate.
2. **Memory Configuration**: Start with 512MB and adjust based on CloudWatch metrics.
3. **Timeout**: Set appropriate timeouts based on expected execution time. Monitor for timeout errors.
4. **Dead Letter Queues**: Always configure DLQ for production workloads.
5. **Environment Variables**: Store sensitive values in AWS Systems Manager Parameter Store or Secrets Manager.
6. **VPC Configuration**: Only use VPC if the Lambda needs to access VPC resources. It adds cold start latency.
7. **Reserved Concurrency**: Set limits to prevent runaway Lambda invocations from consuming all available concurrency.
8. **ARM64 Architecture**: Use ARM64 for better price/performance ratio unless you have x86-specific dependencies.