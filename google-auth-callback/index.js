import fetch from "node-fetch";
import AWS from "aws-sdk";

const ssm = new AWS.SSM();
const secretsManager = new AWS.SecretsManager();

async function getEnvVariable(name) {
  console.log("Start get parameter on SSM parameter store:", name);
  try {
    const result = await ssm
      .getParameter({
        Name: name,
        WithDecryption: true,
      })
      .promise();
    return result.Parameter.Value;
  } catch (error) {
    console.error(`Failed to get ${name} from Parameter Store`, error);
    throw error;
  }
}

async function getSecretValue(secretName) {
  console.log("Start get secret on SSM secrets manager:", secretName);
  try {
    const data = await secretsManager
      .getSecretValue({ SecretId: secretName })
      .promise();
    if ("SecretString" in data) {
      return data.SecretString;
    }
    const buff = Buffer.from(data.SecretBinary, "base64");
    return buff.toString("ascii");
  } catch (error) {
    console.error(
      `Failed to get secret ${secretName} from Secrets Manager`,
      error
    );
    throw error;
  }
}

// async function getEnvVariablesFromSSM() {
//   const names = [
//     "/oauth/google/client_id",
//     "/oauth/google/client_secret",
//     "/oauth/google/redirect_uri",
//     "/oauth/google/refresh_token",
//   ];

//   const [
//     GOOGLE_CLIENT_ID,
//     GOOGLE_CLIENT_SECRET,
//     GOOGLE_REDIRECT_URI,
//     REFRESH_TOKEN,
//   ] = await Promise.all(names.map(getEnvVariable));

//   return {
//     GOOGLE_CLIENT_ID,
//     GOOGLE_CLIENT_SECRET,
//     GOOGLE_REDIRECT_URI,
//     REFRESH_TOKEN,
//   };
// }

async function getAccessToken(
  code,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
) {
  const url = "https://oauth2.googleapis.com/token";
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    code: code,
    grant_type: "authorization_code",
    redirect_uri: GOOGLE_REDIRECT_URI,
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
    console.log("Access token response:", JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error("Error fetching access token:", error);
  }
}

async function storeToken(token) {
  const secretsManager = new AWS.SecretsManager();
  try {
    await secretsManager
      .putSecretValue({
        SecretId: "google_refresh_token",
        SecretString: token,
      })
      .promise();
    console.log("Refresh token successfully stored in AWS Secrets Manager.");
  } catch (error) {
    console.error("Error storing token in Secrets Manager:", error);
  }
}

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));
  const [GOOGLE_CLIENT_ID, GOOGLE_REDIRECT_URI, GOOGLE_CLIENT_SECRET] =
    await Promise.all([
      getEnvVariable("/oauth/google/client_id"),
      getEnvVariable("/oauth/google/redirect_uri"),
      getSecretValue("google_client_secret"),
    ]);
  // Access query parameters from the event object
  const queryParams = event.queryStringParameters;
  // Example: Get a specific query parameter named 'param'
  const paramValue = queryParams ? queryParams.code : null;

  // Log the parameter value
  console.log(`OAuth callback received with code: ${paramValue}`);

  const responseToken = await getAccessToken(
    paramValue,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

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
