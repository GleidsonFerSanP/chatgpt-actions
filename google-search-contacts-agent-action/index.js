import { google } from "googleapis";
import openai from "openai";
import dotenv from "dotenv";
dotenv.config();

// Create an OpenAI client using the default export
const openaiClient = new openai({
  apiKey: process.env.OPENAI_API_KEY, // Your API key from environment variables
});

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
        pageSize: 1000, // Maximum contacts per request
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

// Fetch paginated contacts
async function getPaginatedContacts(pageToken = null) {
  console.log(`getPaginatedContacts init`, pageToken);
  const oAuth2Client = initializeOAuth2Client();
  const service = google.people({ version: "v1", auth: oAuth2Client });
  const response = await service.people.connections.list({
    resourceName: "people/me",
    pageSize: 50,
    pageToken: pageToken,
    personFields: "names,emailAddresses,phoneNumbers,organizations",
  });

  const contacts = response.data.connections || [];
  const nextPageToken = response.data.nextPageToken;
  console.log(`getPaginatedContacts end`, contacts, nextPageToken);
  return { contacts, nextPageToken };
}

// Format contacts for GPT
function formatContactsForPrompt(contacts) {
  return contacts
    .map((contact) => {
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
    })
    .join("\n");
}

// Chunk large data for GPT
function chunkData(data, chunkSize) {
  const chunks = [];
  for (let i = 0; i < data.length; i += chunkSize) {
    chunks.push(data.slice(i, i + chunkSize));
  }
  return chunks;
}

// Refine search with GPT
async function refineSearchWithGPT(userQuery, contactChunk) {
  console.log("refineSearchWithGPTs", userQuery, contactChunk);
  const messages = [
    { role: "system", content: "You are a helpful assistant." },
    {
      role: "user",
      content: `Search for contacts matching this query: "${userQuery}", when I find more tha one result, return all of them formatted as a json list with all details about each.
       Separete each contact with some way that you prefer.
       If you not find the contact just responds NOT_FOUND`,
    },
    {
      role: "assistant",
      content: `Here is the list of contacts:\n${contactChunk.join("\n")}`,
    },
  ];

  try {
    console.log("OpenAI messages", messages);
    const response = await openaiClient.chat.completions.create({
      model: "gpt-3.5-turbo", // You can switch to "gpt-4" for more advanced use cases
      messages: messages,
      max_tokens: 2000,
      temperature: 0.7,
    });
    console.log("OpenAI response", response);
    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error("Error handling OpenAI request:", error.message);
    throw error;
  }
}

// Lambda handler
export const findByQueryWithAI = async (userQuery) => {
  try {
    // Parse input query
    let pageToken = null;
    let found = false;
    let result = "";

    while (!found) {
      // Fetch paginated contacts
      const { contacts, nextPageToken } = await getPaginatedContacts(pageToken);
      console.log("findByQuery contacts", contacts, nextPageToken);
      const formattedContacts = formatContactsForPrompt(contacts);

      console.log("formattedContacts", formattedContacts);

      // Chunk data for GPT
      const contactChunks = chunkData(formattedContacts.split("\n"), 50);
      console.log("contactChunks", JSON.stringify(contactChunks));
      for (const chunk of contactChunks) {
        // Refine search with GPT
        const gptResponse = await refineSearchWithGPT(userQuery, contactChunks);
        result += `\nAI Suggestion:\n${gptResponse}`;

        // Break the loop for simplicity in Lambda (could add confirmation logic here)
        found = true;
        break;
      }

      if (!nextPageToken) {
        break;
      }

      pageToken = nextPageToken;
    }

    // Return result
    return {
      message: "Contacts retrieved successfully.",
      contacts: JSON.stringify({ result }),
    };
  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

const normalizedQuery = (contacts, query) => {
  const normalizedQuery = query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // Filter contacts based on normalized query
  const filteredContacts = contacts.filter((contact) => {
    // Normalize and check names
    const names = contact.names || {};
    const nameMatch = Object.values(names).some((nameField) => {
      if (nameField && typeof nameField === "string") {
        const normalizedNameField = nameField
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return normalizedNameField.includes(normalizedQuery);
      }
      return false;
    });

    // Normalize and check email addresses
    const emailAddresses = contact.emailAddresses || [];
    const emailMatch = emailAddresses.some((email) => {
      if (email && typeof email === "string") {
        const normalizedEmail = email
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return normalizedEmail.includes(normalizedQuery);
      }
      return false;
    });

    // Normalize and check phone numbers
    const phoneNumbers = contact.phoneNumbers || [];
    const phoneMatch = phoneNumbers.some((phone) => {
      if (phone && typeof phone === "string") {
        const normalizedPhone = phone
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return normalizedPhone.includes(normalizedQuery);
      }
      return false;
    });

    // Normalize and check organizations
    const organizations = contact.organizations || [];
    const organizationMatch = organizations.some((org) => {
      if (org && org.name && typeof org.name === "string") {
        const normalizedOrg = org.name
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return normalizedOrg.includes(normalizedQuery);
      }
      return false;
    });

    // Return true if any field matches the query
    return nameMatch || emailMatch || phoneMatch || organizationMatch;
  });

  return filteredContacts;
};

const findByQuery = async (query) => {
  const contacts = await fetchAllContacts();
  return normalizedQuery(contacts, query);
};

// Lambda handler function
export const handler = async (event) => {
  console.log("Start lambda", event);
  try {
    // Parse request body
    const queryParams = event.queryStringParameters;
    const userQuery = queryParams ? queryParams?.query || null : null;
    if (userQuery) {
      const contacts = await findByQuery(userQuery);
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "Contacts retrieved successfully.",
          contacts,
        }),
      };
    }
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
