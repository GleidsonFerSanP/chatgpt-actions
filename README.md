#### generate lambda package:

```bash
 zip -r lambda_function.zip index.js node_modules package.json
```

https://accounts.google.com/o/oauth2/auth?client_id=[CLIENT_ID]&redirect_uri=https://f6eqtnqmqw5qvyc43hi6bvfugm0fruqs.lambda-url.us-east-1.on.aws&response_type=code&scope=https://www.googleapis.com/auth/calendar.events&access_type=offline&prompt=consent

https://accounts.google.com/o/oauth2/auth?client_id=[CLIENT_ID]&redirect_uri=https://fa1xmc5uj9.execute-api.us-east-1.amazonaws.com/google-auth-callback&response_type=code&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events%20https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcontacts&access_type=offline&prompt=consent


{
"message": "Google auth code received with success",
"code": "[AUTH_CODE_FROM_CONSENT_SCREEN]"
}

curl -X POST https://oauth2.googleapis.com/token \
-H "Content-Type: application/x-www-form-urlencoded" \
-d "client_id=[CLIENT_ID]&client_secret=[CLIENT_SECRET]&code=[AUTH_CODE_FROM_CONSENT_SCREEN]&grant_type=authorization_code&redirect_uri=https://f6eqtnqmqw5qvyc43hi6bvfugm0fruqs.lambda-url.us-east-1.on.aws"