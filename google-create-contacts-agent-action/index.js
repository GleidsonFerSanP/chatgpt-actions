import { google } from "googleapis";
import AWS from "aws-sdk";

// Gera um identificador simples de rastreamento
const generateTraceId = () => `trace-${Date.now()}`;

// Mostra o ambiente para fins de debug
function logEnvironment(traceId) {
  console.log(`[${traceId}] Environment Info:`, {
    AWS_REGION: process.env.AWS_REGION,
    NODE_ENV: process.env.NODE_ENV,
    EXECUTION_ENV: process.env.AWS_EXECUTION_ENV,
    STAGE: process.env.STAGE || "dev",
  });
}

// Função para buscar valores do Parameter Store
async function getParameter(name, traceId) {
  console.log(`[${traceId}] Fetching SSM parameter: ${name}`);
  const ssm = new AWS.SSM();
  const result = await ssm
    .getParameter({ Name: name, WithDecryption: true })
    .promise();
  console.log(`[${traceId}] Retrieved parameter: ${name}`);
  return result.Parameter.Value;
}

// Função para buscar segredos do Secrets Manager
async function getSecretValue(secretId, traceId) {
  console.log(`[${traceId}] Fetching secret: ${secretId}`);
  const secretsManager = new AWS.SecretsManager();
  const result = await secretsManager
    .getSecretValue({ SecretId: secretId })
    .promise();
  console.log(`[${traceId}] Secret retrieved: ${secretId}`);
  return JSON.parse(result.SecretString);
}

// Inicializa cliente OAuth2 com valores do SSM e Secrets Manager
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

  const secrets = await getSecretValue("google_client_secret", traceId);
  const GOOGLE_CLIENT_SECRET = secrets.GOOGLE_CLIENT_SECRET;
  const refresh_token = secrets.REFRESH_TOKEN;

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials({ refresh_token });

  console.log(`[${traceId}] OAuth2 client initialized successfully.`);
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
