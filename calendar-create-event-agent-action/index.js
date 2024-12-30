import { google } from "googleapis";

export const handler = async (event) => {
  try {
    const { OAuth2 } = google.auth;

    // Validate required environment variables
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
        "Missing required environment variables for Google OAuth2."
      );
    }

    // Initialize OAuth2 client
    const oAuth2Client = new OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );
    oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

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
