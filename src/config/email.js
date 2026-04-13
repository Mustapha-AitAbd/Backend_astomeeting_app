// config/email.js
const fetch = require('node-fetch');

const transporter = {
  sendMail: async ({ to, subject, html, text }) => {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: {
          name: 'Syni App',
          email: process.env.BREVO_SENDER_EMAIL,
        },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Brevo API error: ${JSON.stringify(data)}`);
    }

    return data;
  },
};

module.exports = transporter;