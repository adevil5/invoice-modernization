variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "invoice"
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
  
  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1827, 3653], var.log_retention_days)
    error_message = "Log retention days must be a valid CloudWatch Logs retention period."
  }
}

# Lambda configuration variables
variable "lambda_runtime" {
  description = "Lambda runtime version"
  type        = string
  default     = "nodejs22.x"
}

variable "lambda_architecture" {
  description = "Lambda CPU architecture"
  type        = string
  default     = "arm64"
  
  validation {
    condition     = contains(["x86_64", "arm64"], var.lambda_architecture)
    error_message = "Lambda architecture must be either x86_64 or arm64."
  }
}

# DynamoDB configuration variables
variable "dynamodb_read_capacity" {
  description = "DynamoDB read capacity units (only used in PROVISIONED mode)"
  type        = number
  default     = 5
}

variable "dynamodb_write_capacity" {
  description = "DynamoDB write capacity units (only used in PROVISIONED mode)"
  type        = number
  default     = 5
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB tables"
  type        = bool
  default     = true
}

variable "dynamodb_autoscale_read_min" {
  description = "Minimum read capacity for DynamoDB auto-scaling"
  type        = number
  default     = 5
}

variable "dynamodb_autoscale_read_max" {
  description = "Maximum read capacity for DynamoDB auto-scaling"
  type        = number
  default     = 100
}

variable "dynamodb_autoscale_write_min" {
  description = "Minimum write capacity for DynamoDB auto-scaling"
  type        = number
  default     = 5
}

variable "dynamodb_autoscale_write_max" {
  description = "Maximum write capacity for DynamoDB auto-scaling"
  type        = number
  default     = 100
}

# API Gateway configuration
variable "api_stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "v1"
}

variable "api_throttle_burst_limit" {
  description = "API Gateway throttle burst limit"
  type        = number
  default     = 100
}

variable "api_throttle_rate_limit" {
  description = "API Gateway throttle rate limit"
  type        = number
  default     = 50
}

# Monitoring and alerting
variable "enable_xray_tracing" {
  description = "Enable AWS X-Ray tracing for Lambda functions"
  type        = bool
  default     = true
}

variable "alarm_email" {
  description = "Email address for CloudWatch alarms"
  type        = string
  default     = ""
}

variable "log_level" {
  description = "Log level for Lambda functions"
  type        = string
  default     = "INFO"
  
  validation {
    condition     = contains(["DEBUG", "INFO", "WARN", "ERROR"], var.log_level)
    error_message = "Log level must be one of: DEBUG, INFO, WARN, ERROR."
  }
}

variable "alert_sns_topic_arn" {
  description = "SNS topic ARN for alerts (e.g., DLQ messages)"
  type        = string
  default     = ""
}

# Feature flags
variable "enable_dead_letter_queue" {
  description = "Enable dead letter queue for async processing"
  type        = bool
  default     = true
}

variable "enable_api_caching" {
  description = "Enable API Gateway caching"
  type        = bool
  default     = false
}

# Lambda specific configuration
variable "pdf_generation_concurrency" {
  description = "Reserved concurrent executions for PDF generation Lambda"
  type        = number
  default     = 10
  
  validation {
    condition     = var.pdf_generation_concurrency >= -1
    error_message = "PDF generation concurrency must be -1 (unreserved) or a positive number."
  }
}

# Security
variable "allowed_cors_origins" {
  description = "Allowed CORS origins for API Gateway"
  type        = list(string)
  default     = ["*"]
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# Environment-specific overrides
variable "environment_config" {
  description = "Override default environment configurations"
  type = object({
    lambda_memory_size    = optional(number)
    lambda_timeout        = optional(number)
    dynamodb_billing_mode = optional(string)
  })
  default = {}
}