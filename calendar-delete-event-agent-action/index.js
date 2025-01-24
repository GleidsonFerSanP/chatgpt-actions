import { google } from "googleapis";
import AWS from "aws-sdk";

// Utility function to validate required environment variables
function validateEnvVariables() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error(
      "Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, or REFRESH_TOKEN."
    );
  }

  return {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  };
}

async function getStoredToken() {
  const ssm = new AWS.SSM();
  console.log("start token retrive");
  try {
    const response = await ssm
      .getParameter({
        Name: "/oauth/google/access_token",
        WithDecryption: true,
      })
      .promise();
    console.log("token retrived successfuly");
    return response.Parameter.Value;
  } catch (error) {
    console.error("Error retrieving token:", error);
    return null;
  }
}

// Function to initialize OAuth2 client
async function initializeOAuth2Client() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    validateEnvVariables();

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  const refresh_token = await getStoredToken();

  oAuth2Client.setCredentials({ refresh_token: refresh_token });

  return oAuth2Client;
}

async function deleteEvent(eventId) {
  const calendar = google.calendar("v3");
  const oAuth2Client = await initializeOAuth2Client();

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
