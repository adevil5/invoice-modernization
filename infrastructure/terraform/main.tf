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