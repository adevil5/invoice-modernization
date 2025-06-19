variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "function_name" {
  description = "Name of the Lambda function (without environment suffix)"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "handler" {
  description = "Lambda function handler"
  type        = string
}

variable "runtime" {
  description = "Lambda runtime"
  type        = string
  default     = "nodejs22.x"
}

variable "timeout" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
}

variable "memory_size" {
  description = "Lambda function memory size in MB"
  type        = number
  default     = 512
}

variable "architecture" {
  description = "Lambda function architecture"
  type        = string
  default     = "arm64"
  validation {
    condition     = contains(["x86_64", "arm64"], var.architecture)
    error_message = "Architecture must be either x86_64 or arm64"
  }
}

variable "s3_bucket" {
  description = "S3 bucket containing the Lambda deployment package"
  type        = string
}

variable "s3_key" {
  description = "S3 key of the Lambda deployment package"
  type        = string
}

variable "environment_variables" {
  description = "Environment variables for the Lambda function"
  type        = map(string)
  default     = {}
}

variable "policy_statements" {
  description = "IAM policy statements for the Lambda function"
  type = list(object({
    Effect   = string
    Action   = list(string)
    Resource = list(string)
  }))
  default = []
}

variable "vpc_config" {
  description = "VPC configuration for the Lambda function"
  type = object({
    subnet_ids         = list(string)
    security_group_ids = list(string)
  })
  default = null
}

variable "dead_letter_config" {
  description = "Dead letter queue configuration"
  type = object({
    target_arn = string
  })
  default = null
}

variable "enable_xray_tracing" {
  description = "Enable AWS X-Ray tracing"
  type        = bool
  default     = true
}

variable "reserved_concurrent_executions" {
  description = "Reserved concurrent executions for this Lambda function"
  type        = number
  default     = -1
}

variable "log_group_name" {
  description = "CloudWatch log group name"
  type        = string
}

variable "log_subscription_destination" {
  description = "ARN of the destination for log subscription"
  type        = string
  default     = null
}

variable "log_filter_pattern" {
  description = "Filter pattern for log subscription"
  type        = string
  default     = ""
}

variable "trigger_permissions" {
  description = "Map of trigger permissions for the Lambda function"
  type = map(object({
    principal  = string
    source_arn = string
  }))
  default = {}
}

variable "publish" {
  description = "Whether to publish a new version of the Lambda function"
  type        = bool
  default     = false
}

variable "enable_provisioned_concurrency" {
  description = "Enable provisioned concurrency and auto-scaling"
  type        = bool
  default     = false
}

variable "provisioned_concurrent_executions_min" {
  description = "Minimum provisioned concurrent executions"
  type        = number
  default     = 1
}

variable "provisioned_concurrent_executions_max" {
  description = "Maximum provisioned concurrent executions"
  type        = number
  default     = 10
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}