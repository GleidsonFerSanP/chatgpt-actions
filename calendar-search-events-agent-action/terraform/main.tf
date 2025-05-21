##########################################
# Terraform AWS Lambda Deployment (main.tf)
##########################################

# AWS provider configuration
provider "aws" {
  region = var.aws_region  # uses us-east-1 by default (see variables.tf)
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

# # Attach AWS managed policy for basic Lambda execution (CloudWatch Logs, etc.)
# resource "aws_iam_role_policy_attachment" "basic_execution" {
#   role       = aws_iam_role.lambda_role.name
#   policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
# }

# # Attach the custom policy to the Lambda role
# resource "aws_iam_role_policy_attachment" "attach_lambda_policy" {
#   role       = aws_iam_role.lambda_role.name
#   policy_arn = aws_iam_policy.lambda_access_params_secrets.arn
# }

data "aws_apigatewayv2_api" "target" {
  api_id = var.apigateway_id
}

# Attach the custom policy to the Lambda role
resource "aws_iam_role_policy_attachment" "attach_lambda_policy" {
  role       = data.aws_iam_role.lambda_role.name
  policy_arn = data.aws_iam_policy.lambda_access_params_secrets.arn
}

# Define the Lambda function
resource "aws_lambda_function" "function_lambda" {
  function_name = var.function_name
  handler       = "index.handler"
  runtime       = "nodejs18.x"
  role          = data.aws_iam_role.lambda_role.arn

  # Path to the zipped Lambda code (created by package.sh)
  filename         = "${path.module}/../lambda_function.zip"
  source_code_hash = filebase64sha256("${path.module}/../lambda_function.zip")

  # (Optional settings)
  memory_size = 128
  timeout     = 120
}

resource "aws_lambda_permission" "allow_api_gateway" {
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.function_lambda.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${data.aws_apigatewayv2_api.target.execution_arn}/*"
}