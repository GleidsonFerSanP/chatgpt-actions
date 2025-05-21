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
  default     = "google_search_contatcts_lambda"
}