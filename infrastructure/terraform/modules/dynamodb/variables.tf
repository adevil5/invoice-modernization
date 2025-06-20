variable "table_name" {
  description = "Name of the DynamoDB table"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "billing_mode" {
  description = "DynamoDB billing mode (PROVISIONED or PAY_PER_REQUEST)"
  type        = string
  default     = "PAY_PER_REQUEST"
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB table"
  type        = bool
  default     = true
}

variable "enable_streams" {
  description = "Enable DynamoDB Streams"
  type        = bool
  default     = true
}

variable "ttl_attribute_name" {
  description = "TTL attribute name for automatic item expiration"
  type        = string
  default     = ""
}

variable "autoscale_read_min_capacity" {
  description = "Minimum read capacity for auto-scaling (only for PROVISIONED mode)"
  type        = number
  default     = 5
}

variable "autoscale_read_max_capacity" {
  description = "Maximum read capacity for auto-scaling (only for PROVISIONED mode)"
  type        = number
  default     = 100
}

variable "autoscale_write_min_capacity" {
  description = "Minimum write capacity for auto-scaling (only for PROVISIONED mode)"
  type        = number
  default     = 5
}

variable "autoscale_write_max_capacity" {
  description = "Maximum write capacity for auto-scaling (only for PROVISIONED mode)"
  type        = number
  default     = 100
}

variable "autoscale_read_target_value" {
  description = "Target utilization percentage for read capacity"
  type        = number
  default     = 70
}

variable "autoscale_write_target_value" {
  description = "Target utilization percentage for write capacity"
  type        = number
  default     = 70
}

variable "common_tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}