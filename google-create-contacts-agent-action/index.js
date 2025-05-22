import { google } from "googleapis";
import AWS from "aws-sdk";

const generateTraceId = () => `trace-${Date.now()}`;

const logEnvironment = (traceId) => {
  console.log(`[${traceId}] Environment:`, {
    AWS_REGION: process.env.AWS_REGION,
    STAGE: process.env.STAGE,
    NODE_ENV: process.env.NODE_ENV,
  });
};

const getParameter = async (name, traceId) => {
  const ssm = new AWS.SSM();
  console.log(`[${traceId}] Fetching parameter: ${name}`);
  try {
    const response = await ssm
      .getParameter({ Name: name, WithDecryption: true })
      .promise();
    console.log(`[${traceId}] Retrieved parameter: ${name}`);
    return response.Parameter.Value;
  } catch (error) {
    console.error(`[${traceId}] Failed to fetch parameter ${name}:`, error);
    throw error;
  }
};

const getSecrets = async (secretId, traceId) => {
  const secretsManager = new AWS.SecretsManager();
  console.log(`[${traceId}] Fetching secret: ${secretId}`);
  try {
    const data = await secretsManager
      .getSecretValue({ SecretId: secretId })
      .promise();
    console.log(`[${traceId}] Secret fetched: ${secretId}`);
    return "SecretString" in data
      ? data.SecretString
      : Buffer.from(data.SecretBinary, "base64").toString("ascii");
  } catch (error) {
    console.error(`[${traceId}] Failed to get secret ${secretId}:`, error);
    throw error;
  }
};

const initializeOAuth2Client = async (traceId) => {
  console.log(`[${traceId}] Initializing OAuth2 client...`);

  const GOOGLE_CLIENT_ID = await getParameter(
    "/oauth/google/client_id",
    traceId
  );
  const GOOGLE_REDIRECT_URI = await getParameter(
    "/oauth/google/redirect_uri",
    traceId
  );
  const clientSecret = await getSecrets("google_client_secret", traceId);
  const refreshToken = await getSecrets("google_refresh_token", traceId);

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    clientSecret,
    GOOGLE_REDIRECT_URI
  );

  oAuth2Client.setCredentials({ refresh_token: refreshToken });

  console.log(`[${traceId}] OAuth2 client initialized.`);
  return oAuth2Client;
};

async function createContact(contact, traceId) {
  console.log(`[${traceId}] Creating contact with data:`, contact);

  const oAuth2Client = await initializeOAuth2Client(traceId);
  const people = google.people({ version: "v1", auth: oAuth2Client });

  try {
    const response = await people.people.createContact({
      requestBody: contact,
    });

    console.log(`[${traceId}] Contact created successfully.`);
    return response;
  } catch (error) {
    console.error(`[${traceId}] Error creating contact:`, {
      message: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// Lambda handler function
export const handler = async (event) => {
  const traceId = generateTraceId();
  console.log(`[${traceId}] Lambda invoked with event:`, event);

  logEnvironment(traceId);

  try {
    const { contact } = JSON.parse(event.body);
    console.log(`[${traceId}] Parsed contact data:`, contact);

    if (!contact) {
      console.warn(`[${traceId}] Missing contact data in request.`);
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing contact data." }),
      };
    }

    const response = await createContact(contact, traceId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Contact created successfully.",
        response: response.data,
        traceId,
      }),
    };
  } catch (error) {
    console.error(`[${traceId}] Error handling request:`, {
      message: error.message,
      stack: error.stack,
    });

    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        message: "An error occurred while processing your request.",
        error: error.message,
        traceId,
      }),
    };
  }
};
