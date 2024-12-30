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

async function fetchAllContacts() {
  const people = google.people("v1");
  const oAuth2Client = initializeOAuth2Client();

  let contacts = [];
  let nextPageToken = null;

  try {
    do {
      // Fetch contacts using pagination
      const response = await people.people.connections.list({
        auth: oAuth2Client,
        resourceName: "people/me",
        pageSize: 100, // Maximum contacts per request
        personFields: "names,emailAddresses,phoneNumbers,organizations", // Specify fields to retrieve
        pageToken: nextPageToken, // For paginated results
      });

      // Collect contacts
      contacts = contacts.concat(response.data.connections || []);
      nextPageToken = response.data.nextPageToken; // Get nextPageToken if more results exist
    } while (nextPageToken);

    console.log(`Total contacts fetched: ${contacts.length}`);
    return contacts.map((contact) => {
      const names = {};
      const contactNames = contact.names?.[0] || {};

      // Add only non-empty name fields
      if (contactNames.displayName)
        names.displayName = contactNames.displayName;
      if (contactNames.familyName) names.familyName = contactNames.familyName;
      if (contactNames.givenName) names.givenName = contactNames.givenName;
      if (contactNames.displayNameLastFirst)
        names.displayNameLastFirst = contactNames.displayNameLastFirst;
      if (contactNames.unstructuredName)
        names.unstructuredName = contactNames.unstructuredName;

      // Remove duplicate email addresses
      const emailAddresses = contact.emailAddresses
        ? [...new Set(contact.emailAddresses.map((it) => it.value))]
        : [];

      // Remove duplicate phone numbers
      const phoneNumbers = contact.phoneNumbers
        ? [...new Set(contact.phoneNumbers.map((it) => it.canonicalForm))]
        : [];

      // Return the object with only non-empty fields
      const result = {};
      if (Object.keys(names).length > 0) result.names = names;
      if (emailAddresses.length > 0) result.emailAddresses = emailAddresses;
      if (phoneNumbers.length > 0) result.phoneNumbers = phoneNumbers;

      return result;
    });
  } catch (error) {
    console.error("Error fetching contacts:", error.message);
    throw error;
  }
}

// Lambda handler function
export const handler = async (event) => {
  console.log("Start lambda", event);
  try {
    const contacts = await fetchAllContacts();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Contacts retrieved successfully.",
        contacts,
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
