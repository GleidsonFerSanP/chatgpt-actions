import { google } from "googleapis";
import AWS from "aws-sdk";

// Utility function to validate required environment variables
function validateEnvVariables() {
  console.log("Validating required environment variables...");
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    console.error(
      "Validation failed: Missing required environment variables.",
      {
        GOOGLE_CLIENT_ID: !!GOOGLE_CLIENT_ID,
        GOOGLE_CLIENT_SECRET: !!GOOGLE_CLIENT_SECRET,
        GOOGLE_REDIRECT_URI: !!GOOGLE_REDIRECT_URI,
      }
    );
    throw new Error(
      "Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI."
    );
  }

  console.log("Environment variables validated successfully.");
  return { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI };
}

async function getStoredToken() {
  const ssm = new AWS.SSM();
  console.log("Attempting to retrieve stored token from AWS SSM...");

  try {
    const response = await ssm
      .getParameter({
        Name: "/oauth/google/access_token",
        WithDecryption: true,
      })
      .promise();

    console.log("Token retrieved successfully.", {
      tokenLength: response.Parameter.Value.length,
    });
    return response.Parameter.Value;
  } catch (error) {
    console.error("Error retrieving token from AWS SSM:", {
      message: error.message,
      stack: error.stack,
    });
    return null;
  }
}

// Function to initialize OAuth2 client
async function initializeOAuth2Client() {
  console.log("Initializing OAuth2 client...");
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    validateEnvVariables();

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  const refresh_token = await getStoredToken();
  if (!refresh_token) {
    console.error(
      "Failed to retrieve refresh token. OAuth2 client initialization aborted."
    );
    throw new Error("Missing refresh token.");
  }

  oAuth2Client.setCredentials({ refresh_token });
  console.log("OAuth2 client initialized successfully.");
  return oAuth2Client;
}

// Function to search for events by summary
async function searchEventsBySummary(
  summaryKeyword,
  timeMin = new Date().toISOString(),
  timeMax = null
) {
  console.log("Searching for events by summary...", {
    summaryKeyword,
    timeMin,
    timeMax,
  });

  const calendar = google.calendar("v3");
  const oAuth2Client = await initializeOAuth2Client();

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
    console.log("Search completed.", { eventCount: events.length, events });
    return events;
  } catch (err) {
    console.error("Error searching events by summary:", {
      message: err.message,
      stack: err.stack,
    });
    throw new Error("Failed to search events. Please try again later.");
  }
}

// Function to search for all events
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

// Lambda handler function
export const handler = async (event) => {
  console.log("Lambda function invoked.", {
    event: JSON.stringify(event, null, 2),
  });

  try {
    // Parse query parameters
    const queryParams = event.queryStringParameters;
    if (!queryParams) {
      console.error("No query parameters provided in the request.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No query parameters provided" }),
      };
    }

    const summary = queryParams.summary || null;
    const startDateTime = queryParams.startDateTime || null;
    const endDateTime = queryParams.endDateTime || null;

    if (!startDateTime || !endDateTime) {
      console.error("Missing required fields: startDateTime or endDateTime.", {
        queryParams,
      });
      return {
        statusCode: 400,
        body: JSON.stringify({
          message:
            "Missing required fields: summary, startDateTime, or endDateTime.",
        }),
      };
    }

    console.log("Searching for events with parameters...", {
      summary,
      startDateTime,
      endDateTime,
    });

    const events = summary
      ? await searchEventsBySummary(summary, startDateTime, endDateTime)
      : await searchEvents(startDateTime, endDateTime);

    console.log("Events retrieved successfully.", {
      eventCount: events.length,
    });
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Events retrieved successfully.",
        events,
      }),
    };
  } catch (error) {
    console.error("Error handling request:", {
      message: error.message,
      stack: error.stack,
    });
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        message: "An error occurred while processing your request.",
        error: error.message,
      }),
    };
  }
};
