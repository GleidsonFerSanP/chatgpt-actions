export const handler = async (event) => {
  console.log("event:", event);
  // Access query parameters from the event object
  const queryParams = event.queryStringParameters;
  // Example: Get a specific query parameter named 'param'
  const paramValue = queryParams ? queryParams.code : null;

  // Log the parameter value
  console.log('Query parameter "code":', paramValue);

  // Return a response
  const response = {
    statusCode: 200,
    body: JSON.stringify({
      message: "Google auth code received with success",
      code: paramValue,
    }),
  };
  return response;
};
