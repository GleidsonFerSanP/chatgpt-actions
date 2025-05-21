import { google } from "googleapis";
import AWS from "aws-sdk";

// Utilitários AWS
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
    if ("SecretString" in data) {
      return data.SecretString;
    }
    const buff = Buffer.from(data.SecretBinary, "base64");
    return buff.toString("ascii");
  } catch (error) {
    console.error(`[${traceId}] Failed to get secret ${secretId}:`, error);
    throw error;
  }
};

// Function to initialize OAuth2 client
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
  const googleClientSecret = await getSecrets("google_client_secret", traceId);
  const googleRefreshToken = await getSecrets("google_refresh_token", traceId);

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    googleClientSecret,
    GOOGLE_REDIRECT_URI
  );

  oAuth2Client.setCredentials({ refresh_token: googleRefreshToken });

  console.log(`[${traceId}] OAuth2 client initialized.`);
  return oAuth2Client;
};

export const handler = async (event) => {
  const traceId = generateTraceId();
  console.log(`[${traceId}] Handler invoked.`);

  logEnvironment(traceId);

  try {
    // Parse request body
    const requestBody = JSON.parse(event.body || "{}");
    console.log(`[${traceId}] Request body parsed:`, requestBody);

    const {
      summary,
      location = "",
      description,
      startDateTime,
      endDateTime,
      attendees = [],
    } = requestBody;

    // Validate required fields in the request body
    if (!summary || !startDateTime || !endDateTime) {
      console.warn(`[${traceId}] Missing required fields`);
      return {
        statusCode: 400,
        body: JSON.stringify({
          message:
            "Missing required fields: summary, startDateTime, or endDateTime.",
          traceId,
        }),
      };
    }

    const calendarEvent = {
      summary,
      location,
      description,
      start: {
        dateTime: startDateTime,
        timeZone: "America/Sao_Paulo",
      },
      end: {
        dateTime: endDateTime,
        timeZone: "America/Sao_Paulo",
      },
      attendees,
    };

    console.log(`[${traceId}] Creating calendar event:`, calendarEvent);

    const oAuth2Client = await initializeOAuth2Client(traceId);

    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: calendarEvent,
    });

    console.log(
      `[${traceId}] Event created successfully:`,
      response.data.htmlLink
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Event created successfully",
        eventLink: response.data.htmlLink,
        traceId,
      }),
    };
  } catch (error) {
    console.error(`[${traceId}] Error creating event:`, {
      message: error.message,
      stack: error.stack,
    });

    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        message: "Error creating event",
        error: error.message,
        traceId,
      }),
    };
  }
};
