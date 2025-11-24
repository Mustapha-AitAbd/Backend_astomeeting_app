require('dotenv').config();
const transporter = require('./src/config/email');

(async () => {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: "Test Nodemailer",
      text: "Hello - This is a test email"
    });
    console.log("Email sent:", info);
  } catch (err) {
    console.error("Email ERROR:", err);
  }
})();
