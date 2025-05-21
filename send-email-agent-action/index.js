// File: index.js
import nodemailer from "nodemailer";
import AWS from "aws-sdk";

// Utilitários AWS
const generateTraceId = () => `trace-${Date.now()}`;

const logEnvironment = (traceId) => {
  console.log(`[${traceId}] Environment:`, {
    AWS_REGION: process.env.AWS_REGION,
    STAGE: process.env.STAGE,
    NODE_ENV: process.env.NODE_ENV,
  });
};

async function getSecrets(secretId, traceId) {
  const secretsManager = new AWS.SecretsManager();
  console.log(`[${traceId}] Fetching secret ${secretId}`);
  try {
    const data = await secretsManager
      .getSecretValue({ SecretId: secretId })
      .promise();
    if ("SecretString" in data) {
      return data.SecretString;
    }
    const buff = Buffer.from(data.SecretBinary, "base64");
    return buff.toString("ascii");
  } catch (error) {
    console.error(
      `Failed to get secret ${secretId} from Secrets Manager`,
      error
    );
    throw error;
  }
}

export const handler = async (event) => {
  try {
    const traceId = generateTraceId();
    logEnvironment(traceId); // já deve estar disponível se vier da handler

    const googleSmtpUser = await getSecrets("google_smtp_user", traceId);
    const googleSmtpPassword = await getSecrets(
      "google_smtp_password",
      traceId
    );

    // Nodemailer configuration for Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: googleSmtpUser,
        pass: googleSmtpPassword,
      },
    });

    // Parse email details from the event
    const { to, subject, text, html } = JSON.parse(event.body);

    if (!to || !subject || !text) {
      throw new Error("Fields 'to', 'subject', and 'text' are required.");
    }

    // Email options
    const mailOptions = {
      from: googleSmtpUser,
      to: to,
      subject: subject,
      text: text,
      html: html || null, // Optional HTML content
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent: ", info.messageId);

    // Success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Email sent successfully",
        messageId: info.messageId,
      }),
    };
  } catch (error) {
    console.error("Error sending email: ", error);

    // Error response
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message,
      }),
    };
  }
};
