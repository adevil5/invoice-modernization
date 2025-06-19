variable "api_id" {
  description = "The ID of the API Gateway REST API"
  type        = string
}

variable "api_resource_id" {
  description = "The ID of the API Gateway resource"
  type        = string
}

variable "allowed_origins" {
  description = "List of allowed CORS origins"
  type        = list(string)
  default     = ["*"]
}