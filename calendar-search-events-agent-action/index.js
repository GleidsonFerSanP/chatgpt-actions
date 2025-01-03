import { google } from "googleapis";

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

// Function to initialize OAuth2 client
function initializeOAuth2Client() {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    REFRESH_TOKEN,
  } = validateEnvVariables();

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

  return oAuth2Client;
}

// Function to search for events
async function searchEventsBySummary(
  summaryKeyword,
  timeMin = new Date().toISOString(),
  timeMax = null
) {
  const calendar = google.calendar("v3");
  const oAuth2Client = initializeOAuth2Client();

  try {
    const res = await calendar.events.list({
      auth: oAuth2Client,
      calendarId: "primary", // Specify the calendar ID
      timeMin, // Start time filter
      timeMax, // End time filter (optional)
      q: summaryKeyword, // Keyword for searching event summary
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = res.data.items || [];
    if (events.length) {
      console.log(`Found ${events.length} matching events:`, events);
    } else {
      console.log("No matching events found.");
    }

    return events;
  } catch (err) {
    console.error("Error searching events:", err.message);
    throw new Error("Failed to search events. Please try again later.");
  }
}

async function searchEvents(
  timeMin = new Date().toISOString(),
  timeMax = null
) {
  const calendar = google.calendar("v3");
  const oAuth2Client = initializeOAuth2Client();

  try {
    const response = await calendar.events.list({
      auth: oAuth2Client,
      calendarId: "primary", // Replace with other calendar IDs if necessary
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items || [];
    if (events.length) {
      console.log(`Found ${events.length} matching events:`, events);
    } else {
      console.log("No matching events found.");
    }

    return events;
  } catch (err) {
    console.error("Error searching events:", err.message);
    throw new Error("Failed to search events. Please try again later.");
  }
}

// Lambda handler function
export const handler = async (event) => {
  console.log("Start lambda", event);
  try {
    // Parse request body
    const queryParams = event.queryStringParameters;

    if (!queryParams) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No query parameters provided" }),
      };
    }

    // Example: Extract specific parameters
    const summary = queryParams.summary || null;
    const startDateTime = queryParams.startDateTime || null;
    const endDateTime = queryParams.endDateTime || null;

    // Validate required fields in the request body
    if (!startDateTime || !endDateTime) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message:
            "Missing required fields: summary, startDateTime, or endDateTime.",
        }),
      };
    }

    console.log("Searching for events with the following parameters:", {
      summary,
      startDateTime,
      endDateTime,
    });

    const events = summary
      ? await searchEventsBySummary(summary, startDateTime, endDateTime)
      : await searchEvents(startDateTime, endDateTime);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Events retrieved successfully.",
        events,
      }),
    };
  } catch (error) {
    console.error("Error handling request:", error.message);

    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        message: "An error occurred while processing your request.",
        error: error.message,
      }),
    };
  }
};
