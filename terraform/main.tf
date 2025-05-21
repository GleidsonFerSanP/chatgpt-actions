provider "aws" {
  region = "us-east-1"
}

# SSM Parameter Store
resource "aws_ssm_parameter" "google_client_id" {
  name        = "/oauth/google/client_id"
  type        = "String"
  value       = var.google_client_id
  description = "Google OAuth Client ID"
}

resource "aws_ssm_parameter" "google_redirect_uri" {
  name        = "/oauth/google/redirect_uri"
  type        = "String"
  value       = var.google_redirect_uri
  description = "Google OAuth Redirect URI"
}

# Secrets Manager
resource "aws_secretsmanager_secret" "google_client_secret" {
  name        = "google_client_secret"
  description = "Google API Client Secret"
}

resource "aws_secretsmanager_secret_version" "google_client_secret_version" {
  secret_id     = aws_secretsmanager_secret.google_client_secret.id
  secret_string = var.google_client_secret
}

resource "aws_secretsmanager_secret" "openai_api_key" {
  name        = "openai_api_key"
  description = "OpenAI API Key"
}

resource "aws_secretsmanager_secret_version" "openai_api_key_version" {
  secret_id     = aws_secretsmanager_secret.openai_api_key.id
  secret_string = var.openai_api_key
}

resource "aws_secretsmanager_secret" "google_refresh_token" {
  name        = "google_refresh_token"
  description = "Google Auth Refresh Token"
}

resource "aws_secretsmanager_secret_version" "google_refresh_token_version" {
  secret_id     = aws_secretsmanager_secret.google_refresh_token.id
  secret_string = var.google_refresh_token
}