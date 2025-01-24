import { google } from "googleapis";
import AWS from "aws-sdk";

// Utility function to validate required environment variables
function validateEnvVariables() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error(
      "Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI."
    );
  }

  return {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  };
}

// Function to initialize OAuth2 client
const initializeOAuth2Client = async () => {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    validateEnvVariables();

  const refresh_token = await getStoredToken();

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials({ refresh_token: refresh_token });

  return oAuth2Client;
};

async function getStoredToken() {
  const ssm = new AWS.SSM();
  try {
    const response = await ssm
      .getParameter({
        Name: "/oauth/google/access_token",
        WithDecryption: true,
      })
      .promise();

    return response.Parameter.Value;
  } catch (error) {
    console.error("Error retrieving token:", error);
    return null;
  }
}

export const handler = async (event) => {
  try {
    // Parse request body
    const requestBody = JSON.parse(event.body || "{}");
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
      return {
        statusCode: 400,
        body: JSON.stringify({
          message:
            "Missing required fields: summary, startDateTime, or endDateTime.",
        }),
      };
    }

    // Prepare calendar event
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

    const oAuth2Client = await initializeOAuth2Client();
    // Insert event into Google Calendar
    const calendar = google.calendar({ version: "v3", auth: oAuth2Client });
    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: calendarEvent,
    });

    console.log("Event created successfully:", response.data.htmlLink);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Event created successfully",
        eventLink: response.data.htmlLink,
      }),
    };
  } catch (error) {
    console.error("Error creating event:", error);

    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        message: "Error creating event",
        error: error.message,
      }),
    };
  }
};
