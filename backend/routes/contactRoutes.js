const express = require('express');
const rateLimit = require('express-rate-limit');
const ContactSubmission = require('../models/ContactSubmission');
const Notification = require('../models/Notification');
const crypto = require('crypto');
// const { sendContactEmail } = require('../mailer'); // Make sure to migrate this later or just mock

const router = express.Router();

const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 3,
  message: { message: "Too many contact requests, please try again later." }
});

router.post('/', contactLimiter, async (req, res) => {
  const { name, email, message } = req.body || {};

  if (!name || !email || !message) {
    return res.status(400).json({ message: 'name, email and message are required.' });
  }

  const emailLower = String(email).trim().toLowerCase();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower);
  if (!emailValid) {
    return res.status(400).json({ message: 'Please enter a valid email address.' });
  }

  const msg = String(message).trim();
  if (msg.length < 5) {
    return res.status(400).json({ message: 'Message is too short.' });
  }
  if (msg.length > 4000) {
    return res.status(400).json({ message: 'Message is too long. Keep it under 4000 characters.' });
  }

  try {
    const submission = await ContactSubmission.create({
      id: crypto.randomUUID(),
      name: String(name).trim(),
      email: emailLower,
      message: msg,
      status: 'new',
      priority: 'normal'
    });

    await Notification.create({
      id: crypto.randomUUID(),
      type: 'contact',
      title: 'New contact message',
      message: `${submission.name} sent a new message.`,
      priority: 'normal'
    });

    try {
        // await sendContactEmail({
        //   name: String(name).trim(),
        //   email: emailLower,
        //   message: msg,
        // });
    } catch (e) {
        console.error("Failed to send contact email async, ignoring", e);
    }

    return res.json({ message: 'Message sent successfully. We will contact you soon.' });
  } catch (err) {
    console.error('Contact submission error:', err);
    return res.status(500).json({ message: 'There was an error sending your message. Please try again later.' });
  }
});

module.exports = router;