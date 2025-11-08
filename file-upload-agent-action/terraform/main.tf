##########################################
# Terraform AWS Lambda Deployment (main.tf)
##########################################

# AWS provider configuration
provider "aws" {
  region = var.aws_region # uses us-east-1 by default (see variables.tf)
}

# Data source: get the default VPC in us-east-1
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_subnet" "selected" {
  for_each = toset(data.aws_subnets.default.ids)
  id       = each.value
}

# Data source: get the default security group for the default VPC
data "aws_security_group" "default" {
  name   = "default"
  vpc_id = data.aws_vpc.default.id
}

# Reference existing IAM role for Lambda
data "aws_iam_role" "lambda_role" {
  name = "lambda_ssm_secrets_role"
}

# Reference existing IAM policy for Lambda access
data "aws_iam_policy" "lambda_access_params_secrets" {
  name = "lambda_read_ssm_secrets"
}

# Create S3 bucket for file uploads
resource "aws_s3_bucket" "file_uploads" {
  bucket = var.s3_bucket_name
}

# Configure S3 bucket public access block
resource "aws_s3_bucket_public_access_block" "file_uploads_pab" {
  bucket = aws_s3_bucket.file_uploads.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

# S3 bucket policy to allow public read access
resource "aws_s3_bucket_policy" "file_uploads_policy" {
  bucket     = aws_s3_bucket.file_uploads.id
  depends_on = [aws_s3_bucket_public_access_block.file_uploads_pab]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.file_uploads.arn}/*"
      }
    ]
  })
}

# S3 bucket CORS configuration
resource "aws_s3_bucket_cors_configuration" "file_uploads_cors" {
  bucket = aws_s3_bucket.file_uploads.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "POST", "PUT"]
    allowed_origins = ["*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# S3 bucket website configuration
resource "aws_s3_bucket_website_configuration" "file_uploads_website" {
  bucket = aws_s3_bucket.file_uploads.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "error.html"
  }
}

# Create IAM policy for S3 access
resource "aws_iam_policy" "lambda_s3_policy" {
  name        = "lambda_s3_file_upload_policy"
  description = "IAM policy for Lambda to access S3 bucket for file uploads"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:PutObjectAcl",
          "s3:DeleteObject"
        ]
        Resource = [
          "${aws_s3_bucket.file_uploads.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.file_uploads.arn
        ]
      }
    ]
  })
}

# Attach S3 policy to Lambda role
resource "aws_iam_role_policy_attachment" "attach_s3_policy" {
  role       = data.aws_iam_role.lambda_role.name
  policy_arn = aws_iam_policy.lambda_s3_policy.arn
}

data "aws_apigatewayv2_api" "target" {
  count  = var.apigateway_id != "" ? 1 : 0
  api_id = var.apigateway_id
}

# Define the Lambda function
resource "aws_lambda_function" "function_lambda" {
  function_name = var.function_name
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  role          = data.aws_iam_role.lambda_role.arn

  # Path to the zipped Lambda code (created by package.sh)
  filename         = "${path.module}/lambda_function.zip"
  source_code_hash = filebase64sha256("${path.module}/lambda_function.zip")

  # Environment variables
  environment {
    variables = {
      S3_BUCKET_NAME = aws_s3_bucket.file_uploads.bucket
      NODE_ENV       = "production"
      STAGE          = "production"
    }
  }

  # (Optional settings)
  memory_size = 256
  timeout     = 60
}

resource "aws_lambda_permission" "allow_api_gateway" {
  count         = var.apigateway_id != "" ? 1 : 0
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.function_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${data.aws_apigatewayv2_api.target[0].execution_arn}/*"
}

# Outputs
output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.function_lambda.function_name
}

output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.function_lambda.arn
}

output "s3_bucket_name" {
  description = "Name of the S3 bucket for file uploads"
  value       = aws_s3_bucket.file_uploads.bucket
}

output "s3_bucket_domain_name" {
  description = "Domain name of the S3 bucket"
  value       = aws_s3_bucket.file_uploads.bucket_domain_name
}

output "s3_bucket_regional_domain_name" {
  description = "Regional domain name of the S3 bucket"
  value       = aws_s3_bucket.file_uploads.bucket_regional_domain_name
}

output "s3_website_endpoint" {
  description = "S3 website endpoint URL"
  value       = aws_s3_bucket_website_configuration.file_uploads_website.website_endpoint
}

output "s3_website_domain" {
  description = "S3 website domain"
  value       = aws_s3_bucket_website_configuration.file_uploads_website.website_domain
}
