########################
# Variable definitions #
########################

# AWS Region (default to us-east-1)
variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "us-east-1"
}

variable "google_client_id" {
  description = "Google API Client ID"
  type        = string
}

variable "google_redirect_uri" {
  description = "Google OAuth2 Redirect URI"
  type        = string
}

variable "google_client_secret" {
  description = "Google API Client Secret"
  type        = string
  sensitive   = true
}

variable "google_refresh_token" {
  description = "Google API refresh token"
  type        = string
  sensitive   = true
  default = "value"
}

variable "openai_api_key" {
  description = "OpenAI API Key"
  type        = string
  sensitive   = true
}