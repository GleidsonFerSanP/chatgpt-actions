// File: index.js
import nodemailer from "nodemailer";

export const handler = async (event) => {
  try {
    // Set Gmail credentials from environment variables
    const { GMAIL_USER, GMAIL_PASS } = process.env;

    if (!GMAIL_USER || !GMAIL_PASS) {
      throw new Error(
        "GMAIL_USER and GMAIL_PASS environment variables are required."
      );
    }

    // Nodemailer configuration for Gmail
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_PASS,
      },
    });

    // Parse email details from the event
    const { to, subject, text, html } = JSON.parse(event.body);

    if (!to || !subject || !text) {
      throw new Error("Fields 'to', 'subject', and 'text' are required.");
    }

    // Email options
    const mailOptions = {
      from: GMAIL_USER,
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
