variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "v1"
}

# Lambda function ARNs
variable "create_invoice_lambda_invoke_arn" {
  description = "Invoke ARN for the create invoice Lambda function"
  type        = string
}

variable "get_invoice_lambda_invoke_arn" {
  description = "Invoke ARN for the get invoice Lambda function"
  type        = string
}

variable "list_invoices_lambda_invoke_arn" {
  description = "Invoke ARN for the list invoices Lambda function"
  type        = string
}

# Lambda function names (for permissions)
variable "create_invoice_lambda_function_name" {
  description = "Name of the create invoice Lambda function"
  type        = string
}

variable "get_invoice_lambda_function_name" {
  description = "Name of the get invoice Lambda function"
  type        = string
}

variable "list_invoices_lambda_function_name" {
  description = "Name of the list invoices Lambda function"
  type        = string
}

# CloudWatch logging
variable "cloudwatch_log_group_arn" {
  description = "ARN of the CloudWatch log group for API Gateway access logs"
  type        = string
  default     = ""
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "api_logging_level" {
  description = "API Gateway logging level (OFF, ERROR, INFO)"
  type        = string
  default     = "ERROR"
  
  validation {
    condition     = contains(["OFF", "ERROR", "INFO"], var.api_logging_level)
    error_message = "API logging level must be one of: OFF, ERROR, INFO"
  }
}

variable "create_cloudwatch_role" {
  description = "Whether to create the CloudWatch role for API Gateway (only needed once per account/region)"
  type        = bool
  default     = false
}

# Throttling
variable "api_throttle_rate_limit" {
  description = "API Gateway throttle rate limit (requests per second)"
  type        = number
  default     = 50
}

variable "api_throttle_burst_limit" {
  description = "API Gateway throttle burst limit"
  type        = number
  default     = 100
}

variable "method_throttle_rate_limit" {
  description = "Method-level throttle rate limit (requests per second)"
  type        = number
  default     = 50
}

variable "method_throttle_burst_limit" {
  description = "Method-level throttle burst limit"
  type        = number
  default     = 100
}

# Quota settings
variable "api_quota_limit" {
  description = "API quota limit (requests per period)"
  type        = number
  default     = 10000
}

variable "api_quota_period" {
  description = "API quota period (DAY, WEEK, MONTH)"
  type        = string
  default     = "DAY"
  
  validation {
    condition     = contains(["DAY", "WEEK", "MONTH"], var.api_quota_period)
    error_message = "API quota period must be one of: DAY, WEEK, MONTH"
  }
}

# Caching
variable "enable_api_caching" {
  description = "Enable API Gateway caching"
  type        = bool
  default     = false
}

variable "api_cache_size" {
  description = "API Gateway cache cluster size (0.5, 1.6, 6.1, 13.5, 28.4, 58.2, 118, 237)"
  type        = string
  default     = "0.5"
  
  validation {
    condition     = contains(["0.5", "1.6", "6.1", "13.5", "28.4", "58.2", "118", "237"], var.api_cache_size)
    error_message = "API cache size must be a valid API Gateway cache cluster size"
  }
}

# CORS
variable "allowed_cors_origins" {
  description = "Allowed CORS origins"
  type        = list(string)
  default     = ["*"]
}

# X-Ray tracing
variable "enable_xray_tracing" {
  description = "Enable AWS X-Ray tracing"
  type        = bool
  default     = true
}

# Tags
variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}