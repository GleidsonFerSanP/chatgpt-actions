provider "aws" {
  region = var.aws_region
}

resource "aws_apigatewayv2_api" "http_api" {
  name          = "unified-agent-api"
  protocol_type = "HTTP"
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.http_api.id
  name        = "$default"
  auto_deploy = true
}

# Example route integrations for each lambda
# Repeat this block for each route listed in the OpenAPI spec

resource "aws_lambda_permission" "allow_apigw" {
  for_each = {
    send_email_event_lambda      = { route_key = "POST /send-email-agent-action" }
    calendar_create_event_lambda = { route_key = "POST /calendar-create-event-agent-action" }
    google_create_contacts_lambda = { route_key = "POST /google-create-contacts-agent-action" }
    calendar_delete_event_lambda = { route_key = "DELETE /calendar-delete-event-agent-action" }
    calendar_search_event_lambda = { route_key = "GET /calendar-search-events-agent-action" }
    google_search_contatcts_lambda = { route_key = "GET /google-search-contacts-agent-action" }
    google_auth_callback_lambda = { route_key = "GET /google-auth-callback" }
  }

  statement_id  = "AllowAPIGatewayInvoke-${each.key}"
  action        = "lambda:InvokeFunction"
  function_name = "${each.key}"
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.http_api.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "lambda" {
  for_each = {
    send_email_event_lambda      = { route_key = "POST /send-email-agent-action" }
    calendar_create_event_lambda = { route_key = "POST /calendar-create-event-agent-action" }
    google_create_contacts_lambda = { route_key = "POST /google-create-contacts-agent-action" }
    calendar_delete_event_lambda = { route_key = "DELETE /calendar-delete-event-agent-action" }
    calendar_search_event_lambda = { route_key = "GET /calendar-search-events-agent-action" }
    google_search_contatcts_lambda = { route_key = "GET /google-search-contacts-agent-action" }
    google_auth_callback_lambda = { route_key = "GET /google-auth-callback" }
  }

  api_id           = aws_apigatewayv2_api.http_api.id
  integration_type = "AWS_PROXY"
  integration_uri  = "arn:aws:apigateway:${var.aws_region}:lambda:path/2015-03-31/functions/arn:aws:lambda:${var.aws_region}:${data.aws_caller_identity.current.account_id}:function:${each.key}/invocations"
  integration_method = "POST"
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "lambda_routes" {
  for_each = {
    send_email_event_lambda      = { route_key = "POST /send-email-agent-action" }
    calendar_create_event_lambda = { route_key = "POST /calendar-create-event-agent-action" }
    google_create_contacts_lambda = { route_key = "POST /google-create-contacts-agent-action" }
    calendar_delete_event_lambda = { route_key = "DELETE /calendar-delete-event-agent-action" }
    calendar_search_event_lambda = { route_key = "GET /calendar-search-events-agent-action" }
    google_search_contatcts_lambda = { route_key = "GET /google-search-contacts-agent-action" }
    google_auth_callback_lambda = { route_key = "GET /google-auth-callback" }
  }

  api_id    = aws_apigatewayv2_api.http_api.id
  route_key = each.value.route_key
  target    = "integrations/${aws_apigatewayv2_integration.lambda[each.key].id}"
}

data "aws_caller_identity" "current" {}
