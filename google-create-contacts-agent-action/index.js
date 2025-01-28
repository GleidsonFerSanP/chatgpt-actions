import { google } from "googleapis";
import dotenv from "dotenv";
import AWS from "aws-sdk";
dotenv.config();

// Utility function to validate required environment variables
function validateEnvVariables() {
  console.log("Validating environment variables...");
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    console.error(
      "Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, or REFRESH_TOKEN."
    );
    throw new Error(
      "Missing required environment variables: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, or REFRESH_TOKEN."
    );
  }

  console.log("Environment variables validated successfully.");
  return {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
  };
}

// Function to initialize OAuth2 client
const initializeOAuth2Client = async () => {
  console.log("Initializing OAuth2 client...");
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
    validateEnvVariables();

  const refresh_token = await getStoredToken();
  console.log("Retrieved refresh token:", refresh_token);

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );
  oAuth2Client.setCredentials({ refresh_token: refresh_token });

  console.log("OAuth2 client initialized successfully.");
  return oAuth2Client;
};

async function getStoredToken() {
  console.log("Fetching stored token from AWS SSM...");
  const ssm = new AWS.SSM();
  try {
    const response = await ssm
      .getParameter({
        Name: "/oauth/google/access_token",
        WithDecryption: true,
      })
      .promise();

    console.log("Token retrieved successfully.");
    return response.Parameter.Value;
  } catch (error) {
    console.error("Error retrieving token:", error);
    return null;
  }
}

async function createContact(contact) {
  console.log("Creating contact with data:", contact);
  const oAuth2Client = await initializeOAuth2Client();

  const people = google.people({ version: "v1", auth: oAuth2Client });

  try {
    const response = await people.people.createContact({
      requestBody: contact,
    });

    console.log("Contact created successfully:", response.data);
    return response;
  } catch (error) {
    console.error("Error creating contact:", error.message);
    throw error;
  }
}

// Lambda handler function
export const handler = async (event) => {
  console.log("Lambda function invoked with event:", event);
  try {
    const { contact } = JSON.parse(event.body);
    console.log("Parsed contact data:", contact);

    if (!contact) {
      console.error("Missing contact data in the request.");
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing contact data." }),
      };
    }

    const response = await createContact(contact);

    console.log("Contact creation response:", response.data);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Contact created successfully.",
        response: response.data,
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
