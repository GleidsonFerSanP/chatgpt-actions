import fetch from "node-fetch";
import AWS from "aws-sdk";
import dotenv from "dotenv";
dotenv.config();

// Utility function to validate required environment variables
function validateEnvVariables() {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    REFRESH_TOKEN,
  } = process.env;

  if (
    !GOOGLE_CLIENT_ID ||
    !GOOGLE_CLIENT_SECRET ||
    !GOOGLE_REDIRECT_URI ||
    !REFRESH_TOKEN
  ) {
    throw new Error(
      "Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, or REFRESH_TOKEN."
    );
  }

  return {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    REFRESH_TOKEN,
  };
}

async function getAccessToken(code) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  const url = "https://oauth2.googleapis.com/token";
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    code: code,
    grant_type: "authorization_code",
    redirect_uri:
      "https://f6eqtnqmqw5qvyc43hi6bvfugm0fruqs.lambda-url.us-east-1.on.aws",
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log(data);
    return data;
  } catch (error) {
    console.error("Error fetching access token:", error);
  }
}

async function storeToken(token) {
  const ssm = new AWS.SSM();
  try {
    await ssm
      .putParameter({
        Name: "/oauth/google/access_token",
        Value: token,
        Type: "SecureString",
        Overwrite: true,
      })
      .promise();
    console.log("Token stored successfully.");
  } catch (error) {
    console.error("Error storing token:", error);
  }
}

export const handler = async (event) => {
  validateEnvVariables();
  console.log("event:", event);
  // Access query parameters from the event object
  const queryParams = event.queryStringParameters;
  // Example: Get a specific query parameter named 'param'
  const paramValue = queryParams ? queryParams.code : null;

  // Log the parameter value
  console.log('Query parameter "code":', paramValue);

  const responseToken = await getAccessToken(paramValue);

  await storeToken(responseToken["refresh_token"]);

  // Return a response
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: "Google auth code received with success",
      code: paramValue,
    }),
  };
  return response;
};
