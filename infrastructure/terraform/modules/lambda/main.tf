terraform {
  required_version = ">= 1.12.0"
}

locals {
  function_name = "${var.project_name}-${var.function_name}-${var.environment}"
}

# IAM role for Lambda execution
resource "aws_iam_role" "lambda_execution" {
  name = "${local.function_name}-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = var.common_tags
}

# Basic Lambda execution policy
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
  role       = aws_iam_role.lambda_execution.name
}

# VPC execution policy (if VPC is configured)
resource "aws_iam_role_policy_attachment" "lambda_vpc_execution" {
  count      = var.vpc_config != null ? 1 : 0
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
  role       = aws_iam_role.lambda_execution.name
}

# X-Ray tracing policy
resource "aws_iam_role_policy_attachment" "lambda_xray" {
  count      = var.enable_xray_tracing ? 1 : 0
  policy_arn = "arn:aws:iam::aws:policy/AWSXRayDaemonWriteAccess"
  role       = aws_iam_role.lambda_execution.name
}

# Custom IAM policy for Lambda function
resource "aws_iam_role_policy" "lambda_custom" {
  count = length(var.policy_statements) > 0 ? 1 : 0
  name  = "${local.function_name}-policy"
  role  = aws_iam_role.lambda_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = var.policy_statements
  })
}

# Lambda function
resource "aws_lambda_function" "this" {
  function_name = local.function_name
  role          = aws_iam_role.lambda_execution.arn
  handler       = var.handler
  runtime       = var.runtime
  timeout       = var.timeout
  memory_size   = var.memory_size
  
  # Deployment package
  s3_bucket = var.s3_bucket
  s3_key    = var.s3_key
  
  # Environment variables
  environment {
    variables = merge(
      {
        NODE_ENV             = var.environment
        PROJECT_NAME         = var.project_name
        AWS_NODEJS_CONNECTION_REUSE_ENABLED = "1"
      },
      var.environment_variables
    )
  }
  
  # VPC configuration
  dynamic "vpc_config" {
    for_each = var.vpc_config != null ? [var.vpc_config] : []
    content {
      subnet_ids         = vpc_config.value.subnet_ids
      security_group_ids = vpc_config.value.security_group_ids
    }
  }
  
  # Dead letter queue configuration
  dynamic "dead_letter_config" {
    for_each = var.dead_letter_config != null ? [var.dead_letter_config] : []
    content {
      target_arn = dead_letter_config.value.target_arn
    }
  }
  
  # Tracing configuration
  tracing_config {
    mode = var.enable_xray_tracing ? "Active" : "PassThrough"
  }
  
  # Reserved concurrent executions
  reserved_concurrent_executions = var.reserved_concurrent_executions
  
  # Architecture
  architectures = [var.architecture]
  
  # Logging configuration
  logging_config {
    log_format = "JSON"
    log_group  = var.log_group_name
  }
  
  tags = merge(var.common_tags, {
    Name = local.function_name
  })
  
  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution,
    aws_iam_role_policy_attachment.lambda_vpc_execution,
    aws_iam_role_policy_attachment.lambda_xray,
    aws_iam_role_policy.lambda_custom
  ]
}

# Lambda function alias for blue-green deployments
resource "aws_lambda_alias" "live" {
  name             = "live"
  description      = "Live alias for ${local.function_name}"
  function_name    = aws_lambda_function.this.function_name
  function_version = var.publish ? aws_lambda_function.this.version : "$LATEST"
}

# Lambda permission for various triggers
resource "aws_lambda_permission" "trigger" {
  for_each = var.trigger_permissions

  statement_id  = each.key
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.this.function_name
  principal     = each.value.principal
  source_arn    = each.value.source_arn
  qualifier     = aws_lambda_alias.live.name
}

# CloudWatch Log Group subscription filter (optional)
resource "aws_cloudwatch_log_subscription_filter" "lambda_logs" {
  count           = var.log_subscription_destination != null ? 1 : 0
  name            = "${local.function_name}-subscription"
  log_group_name  = var.log_group_name
  filter_pattern  = var.log_filter_pattern
  destination_arn = var.log_subscription_destination
}

# Auto-scaling configuration for provisioned concurrency
resource "aws_appautoscaling_target" "lambda_target" {
  count              = var.enable_provisioned_concurrency ? 1 : 0
  max_capacity       = var.provisioned_concurrent_executions_max
  min_capacity       = var.provisioned_concurrent_executions_min
  resource_id        = "function:${aws_lambda_function.this.function_name}:${aws_lambda_alias.live.name}"
  scalable_dimension = "lambda:function:ProvisionedConcurrency"
  service_namespace  = "lambda"
}

resource "aws_appautoscaling_policy" "lambda_policy" {
  count              = var.enable_provisioned_concurrency ? 1 : 0
  name               = "${local.function_name}-scaling-policy"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.lambda_target[0].resource_id
  scalable_dimension = aws_appautoscaling_target.lambda_target[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.lambda_target[0].service_namespace

  target_tracking_scaling_policy_configuration {
    target_value = 0.7
    predefined_metric_specification {
      predefined_metric_type = "LambdaProvisionedConcurrencyUtilization"
    }
  }
}