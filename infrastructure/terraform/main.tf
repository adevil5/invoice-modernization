terraform {
  required_version = ">= 1.12.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend configuration
  # For S3 backend (production use):
  #   terraform init -backend-config=backend-dev.hcl
  # For local backend (development only):
  #   terraform init -backend-config=backend-local.hcl
  backend "local" {
    path = "terraform.tfstate"
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = "invoice-modernization"
      Environment = terraform.workspace
      ManagedBy   = "terraform"
    }
  }
}

# Data sources for availability zones and account ID
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Local variables
locals {
  environment = terraform.workspace
  project     = "invoice-modernization"
  
  # Common tags for all resources
  common_tags = {
    Project     = local.project
    Environment = local.environment
    CreatedAt   = timestamp()
  }
  
  # Environment-specific configurations
  env_config = {
    dev = {
      lambda_memory_size = 512
      lambda_timeout     = 30
      dynamodb_billing_mode = "PAY_PER_REQUEST"
    }
    prod = {
      lambda_memory_size = 1024
      lambda_timeout     = 60
      dynamodb_billing_mode = "PROVISIONED"
    }
  }
  
  current_env_config = local.env_config[local.environment]
}

# S3 bucket for Lambda deployment packages
resource "aws_s3_bucket" "lambda_deployments" {
  bucket = "${local.project}-lambda-deployments-${data.aws_caller_identity.current.account_id}-${local.environment}"
  
  tags = merge(local.common_tags, {
    Name = "${local.project}-lambda-deployments-${local.environment}"
  })
}

resource "aws_s3_bucket_versioning" "lambda_deployments" {
  bucket = aws_s3_bucket.lambda_deployments.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "lambda_deployments" {
  bucket = aws_s3_bucket.lambda_deployments.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "lambda_deployments" {
  bucket = aws_s3_bucket.lambda_deployments.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 bucket for processed invoices (PDFs)
resource "aws_s3_bucket" "invoices" {
  bucket = "${local.project}-invoices-${data.aws_caller_identity.current.account_id}-${local.environment}"
  
  tags = merge(local.common_tags, {
    Name = "${local.project}-invoices-${local.environment}"
  })
}

resource "aws_s3_bucket_versioning" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "invoices" {
  bucket = aws_s3_bucket.invoices.id
  
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# DynamoDB table for invoices
module "invoice_dynamodb" {
  source = "./modules/dynamodb"

  table_name                    = "${local.project}-invoices-${local.environment}"
  environment                   = local.environment
  billing_mode                  = local.current_env_config.dynamodb_billing_mode
  enable_point_in_time_recovery = true
  enable_streams                = true
  
  # Auto-scaling configuration (only used in PROVISIONED mode)
  autoscale_read_min_capacity  = var.dynamodb_autoscale_read_min
  autoscale_read_max_capacity  = var.dynamodb_autoscale_read_max
  autoscale_write_min_capacity = var.dynamodb_autoscale_write_min
  autoscale_write_max_capacity = var.dynamodb_autoscale_write_max
  
  common_tags = local.common_tags
}

# CloudWatch log groups
resource "aws_cloudwatch_log_group" "lambda_logs" {
  name              = "/aws/lambda/${local.project}-${local.environment}"
  retention_in_days = var.log_retention_days
  
  tags = local.common_tags
}

# EventBridge event bus
resource "aws_cloudwatch_event_bus" "main" {
  name = "${local.project}-${local.environment}"
  
  tags = merge(local.common_tags, {
    Name = "${local.project}-event-bus-${local.environment}"
  })
}

# KMS key for encryption
resource "aws_kms_key" "main" {
  description             = "KMS key for ${local.project} ${local.environment}"
  deletion_window_in_days = 10
  enable_key_rotation     = true
  
  tags = merge(local.common_tags, {
    Name = "${local.project}-kms-${local.environment}"
  })
}

resource "aws_kms_alias" "main" {
  name          = "alias/${local.project}-${local.environment}"
  target_key_id = aws_kms_key.main.key_id
}

# SQS Dead Letter Queue for Lambda failures
resource "aws_sqs_queue" "lambda_dlq" {
  name                      = "${local.project}-lambda-dlq-${local.environment}"
  message_retention_seconds = 1209600  # 14 days
  
  tags = merge(local.common_tags, {
    Name = "${local.project}-lambda-dlq-${local.environment}"
  })
}

# Lambda Functions

# Create Invoice Lambda (HTTP API)
module "create_invoice_lambda" {
  source = "./modules/lambda"

  project_name  = local.project
  function_name = "create-invoice"
  environment   = local.environment
  
  handler       = "create-invoice-handler.handler"
  runtime       = "nodejs22.x"
  timeout       = local.current_env_config.lambda_timeout
  memory_size   = local.current_env_config.lambda_memory_size
  architecture  = "arm64"
  
  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = "functions/create-invoice-handler.zip"
  
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  
  environment_variables = {
    DYNAMODB_TABLE_NAME    = module.invoice_dynamodb.table_name
    EVENTBRIDGE_BUS_NAME   = aws_cloudwatch_event_bus.main.name
    KMS_KEY_ID            = aws_kms_key.main.id
    LOG_LEVEL             = var.log_level
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
    },
    {
      Effect = "Allow"
      Action = [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ]
      Resource = [aws_kms_key.main.arn]
    }
  ]
  
  dead_letter_config = {
    target_arn = aws_sqs_queue.lambda_dlq.arn
  }
  
  common_tags = local.common_tags
}

# Process Invoice Lambda (EventBridge triggered)
module "process_invoice_lambda" {
  source = "./modules/lambda"

  project_name  = local.project
  function_name = "process-invoice"
  environment   = local.environment
  
  handler       = "process-invoice-handler.handler"
  runtime       = "nodejs22.x"
  timeout       = 300  # 5 minutes for PDF generation
  memory_size   = 2048  # More memory for Puppeteer
  architecture  = "x86_64"  # Puppeteer/Chromium compatibility
  
  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = "functions/process-invoice-handler.zip"
  
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  
  environment_variables = {
    DYNAMODB_TABLE_NAME    = module.invoice_dynamodb.table_name
    S3_BUCKET_NAME        = aws_s3_bucket.invoices.id
    EVENTBRIDGE_BUS_NAME   = aws_cloudwatch_event_bus.main.name
    KMS_KEY_ID            = aws_kms_key.main.id
    LOG_LEVEL             = var.log_level
    CHROMIUM_PATH         = "/opt/chromium"
  }
  
  policy_statements = [
    {
      Effect = "Allow"
      Action = [
        "dynamodb:GetItem",
        "dynamodb:UpdateItem",
        "dynamodb:Query"
      ]
      Resource = [
        module.invoice_dynamodb.table_arn,
        "${module.invoice_dynamodb.table_arn}/index/*"
      ]
    },
    {
      Effect = "Allow"
      Action = [
        "s3:PutObject",
        "s3:PutObjectAcl"
      ]
      Resource = ["${aws_s3_bucket.invoices.arn}/*"]
    },
    {
      Effect = "Allow"
      Action = ["events:PutEvents"]
      Resource = [aws_cloudwatch_event_bus.main.arn]
    },
    {
      Effect = "Allow"
      Action = [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ]
      Resource = [aws_kms_key.main.arn]
    }
  ]
  
  dead_letter_config = {
    target_arn = aws_sqs_queue.lambda_dlq.arn
  }
  
  # Reserved concurrency for PDF generation
  reserved_concurrent_executions = var.pdf_generation_concurrency
  
  common_tags = local.common_tags
}

# Get Invoice Lambda (HTTP API)
module "get_invoice_lambda" {
  source = "./modules/lambda"

  project_name  = local.project
  function_name = "get-invoice"
  environment   = local.environment
  
  handler       = "get-invoice-handler.handler"
  runtime       = "nodejs22.x"
  timeout       = local.current_env_config.lambda_timeout
  memory_size   = local.current_env_config.lambda_memory_size
  architecture  = "arm64"
  
  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = "functions/get-invoice-handler.zip"
  
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  
  environment_variables = {
    DYNAMODB_TABLE_NAME = module.invoice_dynamodb.table_name
    S3_BUCKET_NAME     = aws_s3_bucket.invoices.id
    KMS_KEY_ID         = aws_kms_key.main.id
    LOG_LEVEL          = var.log_level
  }
  
  policy_statements = [
    {
      Effect = "Allow"
      Action = ["dynamodb:GetItem"]
      Resource = [module.invoice_dynamodb.table_arn]
    },
    {
      Effect = "Allow"
      Action = ["s3:GetObject"]
      Resource = ["${aws_s3_bucket.invoices.arn}/*"]
    },
    {
      Effect = "Allow"
      Action = ["kms:Decrypt"]
      Resource = [aws_kms_key.main.arn]
    }
  ]
  
  common_tags = local.common_tags
}

# List Invoices Lambda (HTTP API)
module "list_invoices_lambda" {
  source = "./modules/lambda"

  project_name  = local.project
  function_name = "list-invoices"
  environment   = local.environment
  
  handler       = "list-invoices-handler.handler"
  runtime       = "nodejs22.x"
  timeout       = local.current_env_config.lambda_timeout
  memory_size   = local.current_env_config.lambda_memory_size
  architecture  = "arm64"
  
  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = "functions/list-invoices-handler.zip"
  
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  
  environment_variables = {
    DYNAMODB_TABLE_NAME = module.invoice_dynamodb.table_name
    KMS_KEY_ID         = aws_kms_key.main.id
    LOG_LEVEL          = var.log_level
    PAGE_SIZE          = "50"
  }
  
  policy_statements = [
    {
      Effect = "Allow"
      Action = [
        "dynamodb:Query",
        "dynamodb:Scan"
      ]
      Resource = [
        module.invoice_dynamodb.table_arn,
        "${module.invoice_dynamodb.table_arn}/index/*"
      ]
    },
    {
      Effect = "Allow"
      Action = ["kms:Decrypt"]
      Resource = [aws_kms_key.main.arn]
    }
  ]
  
  common_tags = local.common_tags
}

# CSV Upload Lambda (S3 triggered)
module "csv_upload_lambda" {
  source = "./modules/lambda"

  project_name  = local.project
  function_name = "csv-upload"
  environment   = local.environment
  
  handler       = "csv-upload-handler.handler"
  runtime       = "nodejs22.x"
  timeout       = 300  # 5 minutes for large CSV files
  memory_size   = 1024
  architecture  = "arm64"
  
  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = "functions/csv-upload-handler.zip"
  
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  
  environment_variables = {
    DYNAMODB_TABLE_NAME    = module.invoice_dynamodb.table_name
    EVENTBRIDGE_BUS_NAME   = aws_cloudwatch_event_bus.main.name
    KMS_KEY_ID            = aws_kms_key.main.id
    LOG_LEVEL             = var.log_level
    MAX_BATCH_SIZE        = "25"
  }
  
  policy_statements = [
    {
      Effect = "Allow"
      Action = ["s3:GetObject"]
      Resource = ["${aws_s3_bucket.invoices.arn}/*"]
    },
    {
      Effect = "Allow"
      Action = [
        "dynamodb:PutItem",
        "dynamodb:BatchWriteItem"
      ]
      Resource = [module.invoice_dynamodb.table_arn]
    },
    {
      Effect = "Allow"
      Action = ["events:PutEvents"]
      Resource = [aws_cloudwatch_event_bus.main.arn]
    },
    {
      Effect = "Allow"
      Action = [
        "kms:Decrypt",
        "kms:GenerateDataKey"
      ]
      Resource = [aws_kms_key.main.arn]
    }
  ]
  
  dead_letter_config = {
    target_arn = aws_sqs_queue.lambda_dlq.arn
  }
  
  trigger_permissions = {
    s3_bucket = {
      principal  = "s3.amazonaws.com"
      source_arn = aws_s3_bucket.invoices.arn
    }
  }
  
  common_tags = local.common_tags
}

# DLQ Handler Lambda
module "dlq_handler_lambda" {
  source = "./modules/lambda"

  project_name  = local.project
  function_name = "dlq-handler"
  environment   = local.environment
  
  handler       = "dlq-handler.handler"
  runtime       = "nodejs22.x"
  timeout       = 60
  memory_size   = 512
  architecture  = "arm64"
  
  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = "functions/dlq-handler.zip"
  
  log_group_name = aws_cloudwatch_log_group.lambda_logs.name
  
  environment_variables = {
    LOG_LEVEL = var.log_level
    SNS_TOPIC_ARN = var.alert_sns_topic_arn
  }
  
  policy_statements = [
    {
      Effect = "Allow"
      Action = [
        "sqs:ReceiveMessage",
        "sqs:DeleteMessage",
        "sqs:GetQueueAttributes"
      ]
      Resource = [aws_sqs_queue.lambda_dlq.arn]
    },
    {
      Effect = "Allow"
      Action = ["sns:Publish"]
      Resource = [var.alert_sns_topic_arn]
    }
  ]
  
  common_tags = local.common_tags
}