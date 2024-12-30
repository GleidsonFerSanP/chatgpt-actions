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

async function deleteEvent(eventId) {
  const calendar = google.calendar("v3");
  const oAuth2Client = initializeOAuth2Client();

  try {
    return await calendar.events.delete({
      auth: oAuth2Client,
      calendarId: "primary", // Replace with your calendarId if different
      eventId,
    });
  } catch (err) {
    console.error("Error deleting events:", err.message);
    throw new Error("Failed to delete events. Please try again later.");
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

    if (!queryParams || !queryParams.eventId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required parameter: eventId" }),
      };
    }

    const eventId = queryParams.eventId;

    const response = await deleteEvent(eventId);
    console.log("Response calendar api", response);
    return {
      statusCode: 202,
      body: JSON.stringify({
        message: "Events deleted successfully.",
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
