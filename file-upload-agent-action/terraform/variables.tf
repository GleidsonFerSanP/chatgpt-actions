########################
# Variable definitions #
########################

# AWS Region (default to us-east-1)
variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "function_name" {
  description = "function name"
  type        = string
  default     = "file_upload_agent_lambda"
}

variable "apigateway_id" {
  description = "api gw id"
  type        = string
  default     = ""
}

variable "s3_bucket_name" {
  description = "S3 bucket name for file uploads"
  type        = string
  default     = "chatgpt-actions-file-uploads"
}
