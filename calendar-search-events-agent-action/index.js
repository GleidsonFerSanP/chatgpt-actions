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

// 🟢 Adicionado parâmetro traceId em searchEvents e searchEventsBySummary
async function searchEventsBySummary(
  summaryKeyword,
  timeMin,
  timeMax,
  traceId
) {
  console.log(`[${traceId}] Searching for events by summary...`, {
    summaryKeyword,
    timeMin,
    timeMax,
  });

  const calendar = google.calendar("v3");
  const oAuth2Client = await initializeOAuth2Client(traceId);

  try {
    const res = await calendar.events.list({
      auth: oAuth2Client,
      calendarId: "primary",
      timeMin,
      timeMax,
      q: summaryKeyword,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = res.data.items || [];
    console.log(`[${traceId}] Search completed.`, {
      eventCount: events.length,
    });
    return events;
  } catch (err) {
    console.error(`[${traceId}] Error searching events by summary:`, {
      message: err.message,
      stack: err.stack,
    });
    throw new Error("Failed to search events. Please try again later.");
  }
}

async function searchEvents(
  timeMin = new Date().toISOString(),
  timeMax = null
) {
  console.log("Searching for all events...", { timeMin, timeMax });

  const calendar = google.calendar("v3");
  const oAuth2Client = await initializeOAuth2Client();

  try {
    const response = await calendar.events.list({
      auth: oAuth2Client,
      calendarId: "primary",
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items || [];
    console.log("Search completed.", { eventCount: events.length, events });
    return events;
  } catch (err) {
    console.error("Error searching events:", {
      message: err.message,
      stack: err.stack,
    });
    throw new Error("Failed to search events. Please try again later.");
  }
}

export const handler = async (event) => {
  const traceId = generateTraceId();
  console.log(`[${traceId}] Lambda handler invoked.`);

  logEnvironment(traceId);
  console.log(`[${traceId}] Event received:`, JSON.stringify(event, null, 2));

  try {
    const queryParams = event.queryStringParameters;
    if (!queryParams) {
      console.warn(`[${traceId}] No query parameters provided.`);
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "No query parameters provided",
          traceId,
        }),
      };
    }

    const {
      summary = null,
      startDateTime = null,
      endDateTime = null,
    } = queryParams;

    if (!startDateTime || !endDateTime) {
      console.warn(
        `[${traceId}] Missing required parameters: startDateTime or endDateTime.`
      );
      return {
        statusCode: 400,
        body: JSON.stringify({
          message:
            "Missing required fields: summary, startDateTime, or endDateTime.",
          traceId,
        }),
      };
    }

    console.log(`[${traceId}] Searching events with:`, {
      summary,
      startDateTime,
      endDateTime,
    });

    const events = summary
      ? await searchEventsBySummary(
          summary,
          startDateTime,
          endDateTime,
          traceId
        )
      : await searchEvents(startDateTime, endDateTime, traceId);

    console.log(`[${traceId}] Events retrieved.`, { count: events.length });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Events retrieved successfully.",
        events,
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
